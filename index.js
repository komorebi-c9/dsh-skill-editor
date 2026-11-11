/**
 * Skill editor, host half.
 *
 * Serves one configured directory (default `~/.agent/skills`) to the browser
 * half through a single exact route on the shared `/api` channel, inside
 * Connection's authentication fence. The route answers the file operations
 * the VSCode-style tree and editor need: root info, directory listing, file
 * read, file save, and root creation. Every path is resolved against the
 * configured root and must stay inside it; the route never sees absolute
 * paths or parent references.
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Exact route path under the shared `/api` channel. */
export const API_PATH = '/api/dsh-skill-editor'

/** Skills directory served when the row config does not name one. */
export const DEFAULT_SKILLS_DIR = '~/.agents/skills'

/** Files above this size are refused for reading into the editor. */
const MAX_READ_BYTES = 2 * 1024 * 1024
/** Save bodies above this size are refused. */
const MAX_WRITE_BYTES = 4 * 1024 * 1024

/**
 * Row config: `dir` names the directory the panel serves. `~` at the start of
 * the value expands to the home directory; unknown keys are dropped.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-skill-editor',
    validate(value) {
      const raw = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
      const issues = []
      let dir = DEFAULT_SKILLS_DIR
      if (raw.dir !== undefined) {
        if (typeof raw.dir !== 'string' || raw.dir.trim() === '') {
          issues.push({ message: 'dir must be a non-empty string', path: ['dir'] })
        } else {
          dir = raw.dir.trim()
        }
      }
      return issues.length > 0 ? { issues } : { value: { dir } }
    },
  },
}

/**
 * Activate the plugin: register the file route on the `/api` channel while a
 * browser connection exists. The route also carries `setDir`, which persists
 * a new directory through the profile's config editor and restarts this row
 * with the new value.
 * @param ctx - owning Host context.
 * @param config - validated row config.
 */
export function apply(ctx, config) {
  const root = expandHome(config.dir)
  const entry = ctx.fiber.entry
  const editor = ctx.get('configEditor')
  ctx.inject(['connection'], (scope) => {
    scope.effect(() => scope.connection.fetch.register({
      path: API_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handle(request, root, entry, editor),
    }), 'dsh-skill-editor: /api route')
  })
}

/** Expand a leading `~` against the home directory. */
function expandHome(dir) {
  if (dir === '~') return os.homedir()
  if (dir.startsWith('~/') || dir.startsWith('~\\')) {
    return path.join(os.homedir(), dir.slice(2))
  }
  return path.resolve(dir)
}

/**
 * Resolve one viewer-relative path inside the root.
 * @param root - configured root directory.
 * @param rel - viewer-relative path, '' meaning the root itself.
 * @returns the absolute target, or undefined when it escapes the root.
 */
function resolveInside(root, rel) {
  if (typeof rel !== 'string' || rel === '') return root
  if (path.isAbsolute(rel)) return undefined
  const target = path.resolve(root, rel)
  return isInside(root, target) ? target : undefined
}

/** @returns whether an absolute path is the root or inside it. */
function isInside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`)
}

/** @returns whether a new entry name is a single safe path segment. */
function isValidName(name) {
  return typeof name === 'string'
    && name !== '' && name !== '.' && name !== '..'
    && !name.includes('/') && !name.includes('\\') && !name.includes('\0')
}

/** @returns a viewer-relative path for one absolute path inside the root. */
function relOf(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/')
}

/**
 * Answer one route request with the JSON operation it names.
 * @param request - authenticated buffered request from the page.
 * @param root - configured root directory.
 * @param entry - the plugin's Loader entry, for config persistence.
 * @param editor - the profile config editor, or undefined.
 * @returns the JSON response.
 */
async function handle(request, root, entry, editor) {
  let body
  try {
    body = await request.json()
  } catch (error) {
    /* invalid JSON body: the request is malformed, not a viewer failure. */
    return fail('bad-request', 'Request body must be a JSON object', 400)
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return fail('bad-request', 'Request body must be a JSON object', 400)
  }
  try {
    switch (body.op) {
      case 'root':
        return Response.json(await opRoot(root))
      case 'list':
        return Response.json(await opList(root, body.path))
      case 'read':
        return Response.json(await opRead(root, body.path))
      case 'write':
        return Response.json(await opWrite(root, body.path, body.content))
      case 'mkdir':
        return Response.json(await opMkdir(root))
      case 'rename':
        return Response.json(await opRename(root, body.path, body.name))
      case 'createFile':
        return Response.json(await opCreateFile(root, body.path, body.name))
      case 'createDir':
        return Response.json(await opCreateDir(root, body.path, body.name))
      case 'delete':
        return Response.json(await opDelete(root, body.path))
      case 'setDir':
        return Response.json(await opSetDir(entry, editor, body.dir))
      default:
        return fail('bad-request', `Unknown op ${JSON.stringify(body.op)}`, 400)
    }
  } catch (error) {
    if (error instanceof ViewerError) {
      return fail(error.code, error.message, error.status)
    }
    const message = error instanceof Error ? error.message : String(error)
    return fail('internal', message, 500)
  }
}

function fail(code, message, status) {
  return Response.json({ ok: false, code, message }, { status, headers: { 'cache-control': 'no-store' } })
}

/** Typed viewer failure carrying its wire code and HTTP status. */
class ViewerError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** @returns root info, including whether it exists yet. */
async function opRoot(root) {
  let exists = true
  try {
    const stat = await fs.stat(root)
    exists = stat.isDirectory()
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') exists = false
    else throw error
  }
  return { ok: true, root, exists, name: path.basename(root) }
}

/** @returns the entries of one directory, folders first, case-insensitive. */
async function opList(root, rel) {
  const target = resolveInside(root, rel)
  if (target === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  let entries
  try {
    entries = await fs.readdir(target, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') throw new ViewerError('not-found', 'Directory not found', 404)
    if (error?.code === 'ENOTDIR') throw new ViewerError('not-a-directory', 'Path is not a directory', 400)
    throw error
  }
  const rows = []
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isFile() && !entry.isSymbolicLink()) continue
    let dir = entry.isDirectory()
    if (entry.isSymbolicLink()) {
      // Report the link target's kind; a broken link shows as a file and a
      // read of it fails with not-found, which the tree displays.
      try {
        dir = (await fs.stat(path.join(target, entry.name))).isDirectory()
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 'ELOOP') throw error
      }
    }
    rows.push({ name: entry.name, dir })
  }
  rows.sort((a, b) => (a.dir === b.dir
    ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    : a.dir ? -1 : 1))
  return { ok: true, path: rel ?? '', entries: rows }
}

/** @returns the text of one regular file under the size cap. */
async function opRead(root, rel) {
  const target = resolveInside(root, rel)
  if (target === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  let stat
  try {
    stat = await fs.stat(target)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', 'File not found', 404)
    throw error
  }
  if (!stat.isFile()) throw new ViewerError('not-a-file', 'Path is not a regular file', 400)
  if (stat.size > MAX_READ_BYTES) {
    throw new ViewerError('too-large', `File is ${stat.size} bytes; the editor opens at most ${MAX_READ_BYTES} bytes`, 413)
  }
  const text = await fs.readFile(target, 'utf8')
  if (text.includes('\u0000')) throw new ViewerError('not-text', 'Binary files cannot be edited', 415)
  return { ok: true, path: rel, text, size: stat.size }
}

/** @returns the write receipt for one existing file. */
async function opWrite(root, rel, content) {
  const target = resolveInside(root, rel)
  if (target === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  if (typeof content !== 'string') throw new ViewerError('bad-request', 'content must be a string', 400)
  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) {
    throw new ViewerError('too-large', `Save body exceeds ${MAX_WRITE_BYTES} bytes`, 413)
  }
  let stat
  try {
    stat = await fs.stat(target)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', 'File not found', 404)
    throw error
  }
  if (!stat.isFile()) throw new ViewerError('not-a-file', 'Path is not a regular file', 400)
  await fs.writeFile(target, content, 'utf8')
  return { ok: true, path: rel, size: Buffer.byteLength(content, 'utf8') }
}

/** @returns the root info once the directory exists. */
async function opMkdir(root) {
  let stat
  try {
    stat = await fs.stat(root)
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
  }
  if (stat !== undefined) {
    if (!stat.isDirectory()) throw new ViewerError('not-a-directory', 'Path is not a directory', 400)
    return { ok: true, root, exists: true, name: path.basename(root) }
  }
  await fs.mkdir(root, { recursive: true })
  const made = await fs.stat(root)
  if (!made.isDirectory()) throw new ViewerError('not-a-directory', 'Path is not a directory', 400)
  return { ok: true, root, exists: true, name: path.basename(root) }
}

/**
 * Move one file or directory to a sibling name.
 * @returns the new viewer-relative path.
 */
async function opRename(root, rel, name) {
  if (typeof rel !== 'string' || rel === '') throw new ViewerError('invalid-path', 'The root directory cannot be renamed', 400)
  if (!isValidName(name)) throw new ViewerError('bad-request', 'Invalid entry name', 400)
  const oldAbs = resolveInside(root, rel)
  if (oldAbs === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  const newAbs = path.join(path.dirname(oldAbs), name)
  if (!isInside(root, newAbs)) throw new ViewerError('invalid-path', 'New name escapes the skills directory', 400)
  try {
    await fs.stat(oldAbs)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', 'Entry not found', 404)
    throw error
  }
  let targetExists = true
  try {
    await fs.stat(newAbs)
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
    targetExists = false
  }
  if (targetExists) throw new ViewerError('conflict', 'An entry with this name already exists', 409)
  await fs.rename(oldAbs, newAbs)
  return { ok: true, path: relOf(root, newAbs) }
}

/**
 * Create one empty file in an existing directory.
 * @returns the new viewer-relative path.
 */
async function opCreateFile(root, dirRel, name) {
  if (!isValidName(name)) throw new ViewerError('bad-request', 'Invalid entry name', 400)
  const dirAbs = resolveInside(root, dirRel ?? '')
  if (dirAbs === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  let dirStat
  try {
    dirStat = await fs.stat(dirAbs)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', 'Directory not found', 404)
    throw error
  }
  if (!dirStat.isDirectory()) throw new ViewerError('not-a-directory', 'Parent is not a directory', 400)
  const fileAbs = path.join(dirAbs, name)
  let targetExists = true
  try {
    await fs.stat(fileAbs)
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
    targetExists = false
  }
  if (targetExists) throw new ViewerError('conflict', 'An entry with this name already exists', 409)
  await fs.writeFile(fileAbs, '', 'utf8')
  return { ok: true, path: relOf(root, fileAbs) }
}

/**
 * Create one directory in an existing directory.
 * @returns the new viewer-relative path.
 */
async function opCreateDir(root, dirRel, name) {
  if (!isValidName(name)) throw new ViewerError('bad-request', 'Invalid entry name', 400)
  const dirAbs = resolveInside(root, dirRel ?? '')
  if (dirAbs === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  let dirStat
  try {
    dirStat = await fs.stat(dirAbs)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', 'Directory not found', 404)
    throw error
  }
  if (!dirStat.isDirectory()) throw new ViewerError('not-a-directory', 'Parent is not a directory', 400)
  const newAbs = path.join(dirAbs, name)
  let targetExists = true
  try {
    await fs.stat(newAbs)
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
    targetExists = false
  }
  if (targetExists) throw new ViewerError('conflict', 'An entry with this name already exists', 409)
  await fs.mkdir(newAbs)
  return { ok: true, path: relOf(root, newAbs) }
}

/**
 * Delete one file or directory (with its contents).
 * @returns the deleted viewer-relative path.
 */
async function opDelete(root, rel) {
  if (typeof rel !== 'string' || rel === '') throw new ViewerError('invalid-path', 'The root directory cannot be deleted', 400)
  const target = resolveInside(root, rel)
  if (target === undefined) throw new ViewerError('invalid-path', 'Path escapes the skills directory', 400)
  try {
    await fs.stat(target)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', 'Entry not found', 404)
    throw error
  }
  await fs.rm(target, { recursive: true })
  return { ok: true, path: rel }
}

/**
 * Persist a new served directory through the profile's config editor. The
 * edit restarts this plugin row, so the route comes back under the new root.
 * @returns the resolved new root path.
 */
async function opSetDir(entry, editor, dir) {
  if (typeof dir !== 'string' || dir.trim() === '') throw new ViewerError('bad-request', 'dir must be a non-empty string', 400)
  if (entry === undefined || editor === undefined) {
    throw new ViewerError('no-config-editor', 'Configuration cannot be saved in this profile', 503)
  }
  const value = dir.trim()
  const target = expandHome(value)
  let stat
  try {
    stat = await fs.stat(target)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new ViewerError('not-found', `Directory not found: ${target}`, 404)
    throw error
  }
  if (!stat.isDirectory()) throw new ViewerError('not-a-directory', `Path is not a directory: ${target}`, 400)
  await editor.edit(entry, current => ({ ...(current ?? {}), dir: value }))
  return { ok: true, dir: value, root: target }
}
