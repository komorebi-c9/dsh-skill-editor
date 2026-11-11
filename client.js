/**
 * Skill editor, browser half: the **Skill editor** sidebar entry and the VSCode-style
 * page it opens — a file tree of the configured skills directory on the left,
 * an editable text editor on the right. File operations go to the package's
 * host route at `/api/dsh-skill-editor`, which sits inside Connection's
 * authentication fence.
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-editor',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const Fragment = React.Fragment

    const NS = 'dshSkillEditor'
    const PANEL_ID = 'skills'
    const API_PATH = '/api/dsh-skill-editor'

    /** Dictionary keys, dot-lowercase to match host conventions. */
    const en = {
      'panel': 'Skill editor',
      'tree.loading': 'Loading…',
      'tree.error': 'Failed to load: {error}',
      'tree.empty': 'No files in this folder.',
      'root.missing': 'The skills directory does not exist yet.',
      'root.path': '{path}',
      'action.createDir': 'Create directory',
      'action.refresh': 'Refresh',
      'action.save': 'Save',
      'action.discard': 'Discard',
      'action.cancel': 'Cancel',
      'action.close': 'Close',
      'action.newFile': 'New file',
      'action.newFolder': 'New folder',
      'action.rename': 'Rename',
      'action.delete': 'Delete',
      'delete.title': 'Delete',
      'delete.body': 'Are you sure you want to delete {name}? This cannot be undone.',
      'delete.bodyDir': 'Are you sure you want to delete the folder {name}, including everything inside it? This cannot be undone.',
      'settings.title': 'Skills directory',
      'settings.body': 'Directory this panel reads and writes:',
      'settings.placeholder': 'Directory path (~ supported)',
      'settings.retryFailed': 'The directory changed but the tree did not load. Use refresh to retry.',
      'create.filePlaceholder': 'File name',
      'create.folderPlaceholder': 'Folder name',
      'error.create': 'Create failed: {error}',
      'error.rename': 'Rename failed: {error}',
      'error.delete': 'Delete failed: {error}',
      'error.switchDir': 'Failed to switch directory: {error}',
      'editor.placeholder': 'Select a file to open it in the editor.',
      'state.saved': 'Saved',
      'state.unsaved': 'Unsaved changes',
      'state.loading': 'Loading…',
      'unsaved.title': 'Unsaved changes',
      'unsaved.body': 'Save changes to {file} before continuing?',
      'error.loadRoot': 'Failed to load the skills directory: {error}',
      'error.save': 'Failed to save: {error}',
      'error.createDir': 'Failed to create the directory: {error}',
    }
    const zh = {
      'panel': '技能编辑器',
      'tree.loading': '加载中…',
      'tree.error': '加载失败：{error}',
      'tree.empty': '此文件夹中没有文件。',
      'root.missing': '技能目录尚不存在。',
      'root.path': '{path}',
      'action.createDir': '创建目录',
      'action.refresh': '刷新',
      'action.save': '保存',
      'action.discard': '放弃',
      'action.cancel': '取消',
      'action.close': '关闭',
      'action.newFile': '新建文件',
      'action.newFolder': '新建文件夹',
      'action.rename': '重命名',
      'action.delete': '删除',
      'delete.title': '删除',
      'delete.body': '确定要删除 {name} 吗？此操作无法撤销。',
      'delete.bodyDir': '确定要删除文件夹 {name} 及其全部内容吗？此操作无法撤销。',
      'settings.title': '技能目录',
      'settings.body': '面板读写目录：',
      'settings.placeholder': '目录路径（支持 ~）',
      'settings.retryFailed': '目录已更改但列表加载失败，请点刷新重试。',
      'create.filePlaceholder': '文件名',
      'create.folderPlaceholder': '文件夹名',
      'error.create': '创建失败：{error}',
      'error.rename': '重命名失败：{error}',
      'error.delete': '删除失败：{error}',
      'error.switchDir': '切换目录失败：{error}',
      'editor.placeholder': '选择左侧文件以在编辑器中打开。',
      'state.saved': '已保存',
      'state.unsaved': '未保存的更改',
      'state.loading': '加载中…',
      'unsaved.title': '未保存的更改',
      'unsaved.body': '继续之前要保存 {file} 的更改吗？',
      'error.loadRoot': '加载技能目录失败：{error}',
      'error.save': '保存失败：{error}',
      'error.createDir': '创建目录失败：{error}',
    }

    /** One JSON operation against the package's host route. */
    async function api(op, fields) {
      const res = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ op }, fields ?? {})),
      })
      let payload = null
      try { payload = await res.json() } catch { payload = null }
      if (!res.ok || payload === null || typeof payload !== 'object' || payload.ok !== true) {
        throw new Error(payload !== null && typeof payload.message === 'string' ? payload.message : `HTTP ${res.status}`)
      }
      return payload
    }

    function baseName(p) {
      const parts = p.split('/')
      return parts[parts.length - 1] || p
    }

    /** Document glyph used by the sidebar entry and the editor placeholder. */
    function IconDoc({ size }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size ?? 16, height: size ?? 16,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z' }),
        h('path', { d: 'M14 3v5h5' }),
        h('path', { d: 'M9 13h6' }),
        h('path', { d: 'M9 16.5h4' }),
      )
    }

    /** The sidebar's Skills entry icon; the sidebar owns the button and state. */
    function SkillsPanelIcon({ size }) {
      return h(IconDoc, { size })
    }

    function Chevron({ open }) {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, className: 'dsv-chevron',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
        style: { transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' },
      }, h('path', { d: 'M6 4l4 4-4 4' }))
    }

    function FolderIcon({ open }) {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, className: 'dsv-ic',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, open
        ? h('path', { d: 'M1.8 12.5V4a1.2 1.2 0 0 1 1.2-1.2h3l1.4 1.6H13a1 1 0 0 1 1 1v1.2L4.6 12.7a1 1 0 0 1-1.4-.9' })
        : h('path', { d: 'M1.8 12.8V4a1.2 1.2 0 0 1 1.2-1.2h3l1.4 1.6H13a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z' }))
    }

    function FileIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, className: 'dsv-ic',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M9.5 2H5a1.2 1.2 0 0 0-1.2 1.2v9.6A1.2 1.2 0 0 0 5 14h6a1.2 1.2 0 0 0 1.2-1.2V6z' }),
        h('path', { d: 'M9.5 2v4h4' }),
      )
    }

    function NewFileIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 13, height: 13,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M9.5 2H5a1.2 1.2 0 0 0-1.2 1.2v9.6A1.2 1.2 0 0 0 5 14h6a1.2 1.2 0 0 0 1.2-1.2V6z' }),
        h('path', { d: 'M9.5 2v4h4' }),
        h('path', { d: 'M7.2 8.4v3.2M5.6 10h3.2' }),
      )
    }

    function NewFolderIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 13, height: 13,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M1.8 12.8V4a1.2 1.2 0 0 1 1.2-1.2h3l1.4 1.6H13a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z' }),
        h('path', { d: 'M8 7.4v3.2M6.4 9h3.2' }),
      )
    }

    function RenameIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 13, height: 13,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M11.3 2.7l2 2L5.6 12.4l-2.8.8.8-2.8z' }),
      )
    }

    function DeleteIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 13, height: 13,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('path', { d: 'M2.8 4h10.4M6.4 4V2.8h3.2V4M4.4 4l.5 8.8a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9L11.6 4' }),
        h('path', { d: 'M6.6 6.6v3.8M9.4 6.6v3.8' }),
      )
    }

    /** Gear glyph for the directory settings control (Material settings path, Apache-2.0). */
    function SettingsIcon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 14, height: 14,
        fill: 'currentColor', 'aria-hidden': true,
      }, h('path', { d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' }))
    }

    /** Inline tree input for creating a file or folder in one directory. */
    function CreateInput({ placeholder, onCommit, onCancel }) {
      const [name, setName] = React.useState('')
      const commit = () => onCommit(name)
      const cancel = () => onCancel()
      return h('input', {
        className: 'dsv-inline-input',
        value: name,
        placeholder,
        autoFocus: true,
        spellCheck: false,
        onFocus: (event) => event.target.select(),
        onChange: (event) => setName(event.target.value),
        onClick: (event) => event.stopPropagation(),
        onKeyDown: (event) => {
          event.stopPropagation()
          if (event.key === 'Enter') commit()
          else if (event.key === 'Escape') cancel()
        },
        onBlur: cancel,
      })
    }

    /** Inline tree input for renaming one entry. */
    function RenameInput({ initial, onCommit, onCancel }) {
      const [name, setName] = React.useState(initial)
      return h('input', {
        className: 'dsv-inline-input',
        value: name,
        autoFocus: true,
        spellCheck: false,
        onFocus: (event) => {
          event.target.select()
          if (initial.includes('.')) {
            const dot = initial.lastIndexOf('.')
            event.target.setSelectionRange(0, Math.max(dot, 0))
          }
        },
        onChange: (event) => setName(event.target.value),
        onClick: (event) => event.stopPropagation(),
        onDoubleClick: (event) => event.stopPropagation(),
        onKeyDown: (event) => {
          event.stopPropagation()
          if (event.key === 'Enter') onCommit(name)
          else if (event.key === 'Escape') onCancel()
        },
        onBlur: () => onCancel(),
      })
    }

    /** Directory settings dialog: one path input plus a save button. */
    function DirDialog({ title, body, initial, placeholder, saveLabel, onCommit, onCancel }) {
      const [value, setValue] = React.useState(initial)
      return h('div', { className: 'dsv-dialog dsv-dialog-wide', role: 'dialog' },
        h('div', { className: 'dsv-dialog-title' }, title),
        h('div', { className: 'dsv-dialog-body' }, body),
        h('div', { className: 'dsv-dialog-field' },
          h('input', {
            className: 'dsv-inline-input dsv-inline-wide',
            value,
            placeholder,
            autoFocus: true,
            spellCheck: false,
            onFocus: (event) => event.target.select(),
            onChange: (event) => setValue(event.target.value),
            onKeyDown: (event) => {
              event.stopPropagation()
              if (event.key === 'Enter') onCommit(value)
              else if (event.key === 'Escape') onCancel()
            },
          }),
          h('button', { type: 'button', className: 'dsv-btn dsv-btn-primary', onClick: () => onCommit(value) }, saveLabel)))
    }

    /** The Skills main page: tree left, editor right. */
    function SkillsPanel({ t }) {
      const [root, setRoot] = React.useState(null)
      const [listings, setListings] = React.useState({})
      const [expanded, setExpanded] = React.useState(() => new Set(['']))
      const [open, setOpen] = React.useState(null)
      const [pending, setPending] = React.useState(null)
      const [banner, setBanner] = React.useState(null)
      const [mkdirBusy, setMkdirBusy] = React.useState(false)
      const [treeCreate, setTreeCreate] = React.useState(null)
      const [renaming, setRenaming] = React.useState(null)
      const [confirmDelete, setConfirmDelete] = React.useState(null)
      const [dirDialog, setDirDialog] = React.useState(null)
      const taRef = React.useRef(null)
      const gutterRef = React.useRef(null)

      const dirty = open !== null && open.status === 'ready' && open.text !== open.savedText

      async function loadListing(rel, force) {
        if (force !== true) {
          const current = listings[rel]
          if (current !== undefined && (current.status === 'loading' || current.status === 'ready')) return
        }
        setListings(prev => Object.assign({}, prev, { [rel]: { status: 'loading' } }))
        try {
          const data = await api('list', { path: rel })
          setListings(prev => Object.assign({}, prev, { [rel]: { status: 'ready', entries: data.entries } }))
        } catch (error) {
          setListings(prev => Object.assign({}, prev, { [rel]: { status: 'error', error: error.message } }))
        }
      }

      async function loadRoot() {
        setBanner(null)
        try {
          const info = await api('root')
          setRoot(info)
          if (info.exists) {
            setExpanded(new Set(['']))
            void loadListing('', true)
          }
        } catch (error) {
          setBanner(t('error.loadRoot', { error: error.message }))
        }
      }

      React.useEffect(() => { void loadRoot() }, []) // eslint-disable-line react-hooks/exhaustive-deps

      function toggleDir(rel) {
        const wasOpen = expanded.has(rel)
        setExpanded(prev => {
          const next = new Set(prev)
          if (wasOpen) next.delete(rel)
          else next.add(rel)
          return next
        })
        if (!wasOpen && listings[rel] === undefined) void loadListing(rel, true)
      }

      async function doOpen(path) {
        setOpen({ path, text: '', savedText: '', status: 'loading' })
        try {
          const data = await api('read', { path })
          setOpen({ path, text: data.text, savedText: data.text, status: 'ready' })
          requestAnimationFrame(() => {
            if (taRef.current) taRef.current.focus()
          })
        } catch (error) {
          setOpen({ path, text: '', savedText: '', status: 'error', error: error.message })
        }
      }

      function requestOpen(path) {
        if (dirty && open.path !== path) {
          setPending({ kind: 'open', path })
          return
        }
        void doOpen(path)
      }

      async function doSave() {
        if (open === null || open.status !== 'ready' || open.text === open.savedText) return
        const current = open
        setBanner(null)
        try {
          await api('write', { path: current.path, content: current.text })
          setOpen(prev => prev !== null && prev.path === current.path ? Object.assign({}, prev, { savedText: current.text }) : prev)
        } catch (error) {
          setBanner(t('error.save', { error: error.message }))
        }
      }

      async function doRefresh() {
        const openPath = open !== null ? open.path : null
        setOpen(openPath === null ? null : { path: openPath, text: '', savedText: '', status: 'loading' })
        setListings({})
        setBanner(null)
        try {
          const info = await api('root')
          setRoot(info)
          if (info.exists) {
            setExpanded(new Set(['']))
            await loadListing('', true)
            if (openPath !== null) void doOpen(openPath)
          }
        } catch (error) {
          setBanner(t('error.loadRoot', { error: error.message }))
        }
      }

      function requestRefresh() {
        if (dirty) {
          setPending({ kind: 'refresh' })
          return
        }
        void doRefresh()
      }

      function requestClose() {
        if (dirty) {
          setPending({ kind: 'close' })
          return
        }
        setOpen(null)
      }

      async function createDir() {
        setMkdirBusy(true)
        setBanner(null)
        try {
          const info = await api('mkdir')
          setRoot(info)
          setExpanded(new Set(['']))
          void loadListing('', true)
        } catch (error) {
          setBanner(t('error.createDir', { error: error.message }))
        } finally {
          setMkdirBusy(false)
        }
      }

      function parentOf(rel) {
        const index = rel.lastIndexOf('/')
        return index === -1 ? '' : rel.slice(0, index)
      }

      function remapPath(p, oldRel, newRel) {
        if (p === oldRel) return newRel
        if (p.startsWith(`${oldRel}/`)) return newRel + p.slice(oldRel.length)
        return p
      }

      function startCreate(kind, dir) {
        if (renaming !== null) setRenaming(null)
        setTreeCreate({ kind, dir })
      }

      async function commitCreate(name) {
        const current = treeCreate
        setTreeCreate(null)
        if (current === null) return
        const trimmed = name.trim()
        if (trimmed === '') return
        setBanner(null)
        try {
          await api(current.kind === 'file' ? 'createFile' : 'createDir', { path: current.dir, name: trimmed })
          void loadListing(current.dir, true)
        } catch (error) {
          setBanner(t('error.create', { error: error.message }))
        }
      }

      function requestDelete(rel, isDir) {
        setConfirmDelete({ path: rel, name: baseName(rel), dir: isDir })
      }

      async function commitDir(value) {
        const trimmed = value.trim()
        setDirDialog(null)
        if (trimmed === '') return
        setBanner(null)
        try {
          const data = await api('setDir', { dir: trimmed })
          // The host row restarts with the new config; show the new root now
          // and wait for the route to come back before reloading the tree.
          setRoot({ root: data.root, exists: true, name: baseName(data.root) })
          setOpen(null)
          setExpanded(new Set(['']))
          setListings({ '': { status: 'loading' } })
          for (let attempt = 0; attempt < 8; attempt++) {
            try {
              const listing = await api('list', { path: '' })
              setListings({ '': { status: 'ready', entries: listing.entries } })
              return
            } catch (error) {
              /* the restarted route may not be ready yet */
              await new Promise(resolve => setTimeout(resolve, 400))
            }
          }
          setBanner(t('settings.retryFailed'))
          setListings({ '': { status: 'error', error: t('settings.retryFailed') } })
        } catch (error) {
          setBanner(t('error.switchDir', { error: error.message }))
        }
      }

      async function confirmDeleteNow() {
        const target = confirmDelete
        setConfirmDelete(null)
        if (target === null) return
        setBanner(null)
        try {
          await api('delete', { path: target.path })
          // Drop the deleted directory from the expansion set, including its children.
          setExpanded(prev => {
            const next = new Set()
            for (const key of prev) {
              if (key === target.path || key.startsWith(`${target.path}/`)) continue
              next.add(key)
            }
            return next
          })
          setOpen(prev => prev !== null && (prev.path === target.path || prev.path.startsWith(`${target.path}/`)) ? null : prev)
          void loadListing(parentOf(target.path), true)
        } catch (error) {
          setBanner(t('error.delete', { error: error.message }))
        }
      }

      function startRename(path) {
        if (treeCreate !== null) setTreeCreate(null)
        setRenaming(path)
      }

      async function commitRename(name) {
        const oldRel = renaming
        setRenaming(null)
        if (oldRel === null) return
        const trimmed = name.trim()
        if (trimmed === '' || trimmed === baseName(oldRel)) return
        const dir = parentOf(oldRel)
        setBanner(null)
        try {
          const data = await api('rename', { path: oldRel, name: trimmed })
          const newRel = data.path
          // The renamed entry keeps its loaded listing and expansion under the new key.
          setListings(prev => {
            const next = {}
            for (const key of Object.keys(prev)) {
              next[remapPath(key, oldRel, newRel)] = prev[key]
            }
            return next
          })
          setExpanded(prev => {
            const next = new Set()
            for (const key of prev) next.add(remapPath(key, oldRel, newRel))
            return next
          })
          setOpen(prev => prev !== null ? Object.assign({}, prev, { path: remapPath(prev.path, oldRel, newRel) }) : prev)
          void loadListing(dir, true)
        } catch (error) {
          setBanner(t('error.rename', { error: error.message }))
        }
      }

      async function resolvePending(choice) {
        const action = pending
        setPending(null)
        if (action === null || choice === 'cancel') return
        if (choice === 'save') {
          const current = open
          try {
            await api('write', { path: current.path, content: current.text })
            setOpen(prev => prev !== null && prev.path === current.path ? Object.assign({}, prev, { savedText: current.text }) : prev)
          } catch (error) {
            setBanner(t('error.save', { error: error.message }))
            return
          }
        }
        if (action.kind === 'open') void doOpen(action.path)
        else if (action.kind === 'refresh') void doRefresh()
        else if (action.kind === 'close') setOpen(null)
      }

      const onKey = (event) => {
        if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault()
          void doSave()
        }
      }

      const onScroll = () => {
        if (gutterRef.current !== null && taRef.current !== null) {
          gutterRef.current.scrollTop = taRef.current.scrollTop
        }
      }

      function renderCreateInput(dir, pad) {
        if (treeCreate === null || treeCreate.dir !== dir) return null
        return h('div', { key: `${dir}#create`, className: 'dsv-row', style: { paddingLeft: pad } },
          treeCreate.kind === 'file' ? h(NewFileIcon) : h(NewFolderIcon),
          h(CreateInput, {
            placeholder: t(treeCreate.kind === 'file' ? 'create.filePlaceholder' : 'create.folderPlaceholder'),
            onCommit: commitCreate,
            onCancel: () => setTreeCreate(null),
          }))
      }

      function rowActions(rel, isDir) {
        const actions = []
        if (isDir) {
          actions.push(h('button', {
            key: 'new-file', type: 'button', className: 'dsv-row-btn',
            title: t('action.newFile'), 'aria-label': t('action.newFile'),
            onClick: (event) => { event.stopPropagation(); startCreate('file', rel) },
          }, h(NewFileIcon)))
          actions.push(h('button', {
            key: 'new-folder', type: 'button', className: 'dsv-row-btn',
            title: t('action.newFolder'), 'aria-label': t('action.newFolder'),
            onClick: (event) => { event.stopPropagation(); startCreate('dir', rel) },
          }, h(NewFolderIcon)))
        }
        actions.push(h('button', {
          key: 'rename', type: 'button', className: 'dsv-row-btn',
          title: t('action.rename'), 'aria-label': t('action.rename'),
          onClick: (event) => { event.stopPropagation(); startRename(rel) },
        }, h(RenameIcon)))
        actions.push(h('button', {
          key: 'delete', type: 'button', className: 'dsv-row-btn',
          title: t('action.delete'), 'aria-label': t('action.delete'),
          onClick: (event) => { event.stopPropagation(); requestDelete(rel, isDir) },
        }, h(DeleteIcon)))
        return h('span', { className: 'dsv-row-actions', onClick: (event) => event.stopPropagation() }, actions)
      }

      function rowLabel(rel, name, pad) {
        if (renaming === rel) {
          return h(RenameInput, {
            initial: name,
            onCommit: commitRename,
            onCancel: () => setRenaming(null),
          })
        }
        return h('span', { className: 'dsv-row-label' }, name)
      }

      function renderRows(rel, depth) {
        const listing = listings[rel]
        const pad = 8 + depth * 14
        if (listing === undefined || listing.status === 'loading') {
          return [
            h('div', { key: `${rel}#loading`, className: 'dsv-row dsv-row-subtle', style: { paddingLeft: pad } },
              t('tree.loading')),
            renderCreateInput(rel, pad),
          ]
        }
        if (listing.status === 'error') {
          return h('div', { key: `${rel}#error`, className: 'dsv-row dsv-row-error', style: { paddingLeft: pad } },
            t('tree.error', { error: listing.error }))
        }
        if (listing.entries.length === 0) {
          return renderCreateInput(rel, pad) ?? h('div', { key: `${rel}#empty`, className: 'dsv-row dsv-row-subtle', style: { paddingLeft: pad } },
            t('tree.empty'))
        }
        return listing.entries.map(entry => {
          const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`
          if (entry.dir) {
            const isOpen = expanded.has(childRel) || (treeCreate !== null && treeCreate.dir === childRel)
            return h(Fragment, { key: childRel },
              h('div', {
                className: 'dsv-row', role: 'treeitem', 'aria-expanded': isOpen,
                style: { paddingLeft: pad },
                onClick: () => toggleDir(childRel),
                onDoubleClick: () => startRename(childRel),
              },
                h(Chevron, { open: isOpen }),
                h(FolderIcon, { open: isOpen }),
                rowLabel(childRel, entry.name, pad),
                rowActions(childRel, true)),
              isOpen ? h('div', { role: 'group' },
                renderRows(childRel, depth + 1),
                renderCreateInput(childRel, pad + 14)) : null)
          }
          const active = open !== null && open.path === childRel
          return h('div', {
            key: childRel,
            className: `dsv-row${active ? ' dsv-row-active' : ''}`,
            role: 'treeitem',
            style: { paddingLeft: pad },
            onClick: () => requestOpen(childRel),
            onDoubleClick: () => startRename(childRel),
          },
            h('span', { className: 'dsv-spacer' }),
            h(FileIcon),
            rowLabel(childRel, entry.name, pad),
            rowActions(childRel, false))
        })
      }

      const rootListing = listings['']
      const lineCount = open !== null && open.status === 'ready' ? open.text.split('\n').length : 0
      const gutterWidth = 12 + String(lineCount).length * 8 + 12

      const statusText = banner !== null
        ? { text: banner, error: true }
        : open === null
          ? null
          : open.status === 'loading'
            ? { text: t('state.loading'), error: false }
            : open.status === 'error'
              ? { text: open.error, error: true }
              : dirty
                ? { text: t('state.unsaved'), error: false }
                : { text: t('state.saved'), error: false }

      return h(Fragment, null,
        h('style', null, CSS),
        h('div', { className: 'dsv-root', onKeyDown: onKey },
          h('aside', { className: 'dsv-tree' },
            h('div', { className: 'dsv-tree-head' },
              h('span', { className: 'dsv-tree-title' }, root !== null ? root.name : t('panel')),
              h('span', { className: 'dsv-head-actions' },
                h('button', {
                  type: 'button', className: 'dsv-row-btn', title: t('action.newFile'),
                  'aria-label': t('action.newFile'), onClick: () => startCreate('file', ''),
                }, h(NewFileIcon)),
                h('button', {
                  type: 'button', className: 'dsv-row-btn', title: t('action.newFolder'),
                  'aria-label': t('action.newFolder'), onClick: () => startCreate('dir', ''),
                }, h(NewFolderIcon)),
                h('button', {
                  type: 'button', className: 'dsv-row-btn', title: t('action.refresh'),
                  'aria-label': t('action.refresh'), onClick: requestRefresh, disabled: root === null,
                }, h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
                  h('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9' }),
                  h('path', { d: 'M13.5 2.5v2.6h-2.6' }))),
                h('button', {
                  type: 'button', className: 'dsv-row-btn', title: t('settings.title'),
                  'aria-label': t('settings.title'), onClick: () => setDirDialog({}), disabled: root === null,
                }, h(SettingsIcon)))),
            h('div', { className: 'dsv-tree-body', role: 'tree' },
              root === null
                ? h('div', { className: 'dsv-row dsv-row-subtle', style: { paddingLeft: 8 } }, t('tree.loading'))
                : !root.exists
                  ? h('div', { className: 'dsv-tree-missing' },
                      h('p', null, t('root.missing')),
                      h('code', null, root.root),
                      h('button', {
                        type: 'button', className: 'dsv-btn dsv-btn-primary', onClick: createDir, disabled: mkdirBusy,
                      }, mkdirBusy ? t('tree.loading') : t('action.createDir')))
                  : h(Fragment, null, renderCreateInput('', 8), renderRows('', 0)))),
          h('section', { className: 'dsv-editor' },
            h('div', { className: 'dsv-tabbar' },
              open === null
                ? h('span', { className: 'dsv-tab-name dsv-tab-muted' }, t('panel'))
                : h(Fragment, null,
                    h(IconDoc, { size: 14 }),
                    h('span', { className: 'dsv-tab-name' }, baseName(open.path)),
                    dirty ? h('span', { className: 'dsv-dirty', title: t('state.unsaved') }) : null),
              h('span', { className: 'dsv-spacer-g' }),
              open !== null && open.status === 'ready'
                ? h('button', {
                    type: 'button', className: 'dsv-btn', onClick: doSave, disabled: !dirty,
                  }, t('action.save'))
                : null,
              open !== null
                ? h('button', {
                    type: 'button', className: 'dsv-iconbtn', title: t('action.close'),
                    'aria-label': t('action.close'), onClick: requestClose,
                  }, h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
                    h('path', { d: 'M4 4l8 8M12 4l-8 8' })))
                : null),
            open === null
              ? h('div', { className: 'dsv-empty' },
                  h(IconDoc, { size: 40 }),
                  h('p', null, t('editor.placeholder')))
              : open.status !== 'ready'
                ? h('div', { className: 'dsv-empty' },
                    open.status === 'error'
                      ? h('p', { className: 'dsv-error-text' }, open.error)
                      : h('p', null, t('state.loading')))
                : h('div', { className: 'dsv-code' },
                    h('div', { ref: gutterRef, className: 'dsv-gutter', style: { width: gutterWidth }, 'aria-hidden': true },
                      h('pre', null, Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'))),
                    h('textarea', {
                      ref: taRef, className: 'dsv-ta', value: open.text, spellCheck: false,
                      onChange: (event) => setOpen(prev => prev !== null && prev.path === open.path
                        ? Object.assign({}, prev, { text: event.target.value })
                        : prev),
                      onScroll,
                    })),
            h('div', { className: 'dsv-status' },
              h('span', { className: 'dsv-status-path' }, open !== null ? open.path : root !== null ? root.root : ''),
              h('span', { className: 'dsv-spacer-g' }),
              statusText !== null
                ? h('span', { className: statusText.error ? 'dsv-status-error' : 'dsv-status-ok' }, statusText.text)
                : null),
            pending !== null
              ? h('div', { className: 'dsv-overlay' },
                  h('div', { className: 'dsv-dialog', role: 'alertdialog' },
                    h('div', { className: 'dsv-dialog-title' }, t('unsaved.title')),
                    h('div', { className: 'dsv-dialog-body' }, t('unsaved.body', { file: baseName(open.path) })),
                    h('div', { className: 'dsv-dialog-actions' },
                      h('button', { type: 'button', className: 'dsv-btn dsv-btn-primary', onClick: () => resolvePending('save') }, t('action.save')),
                      h('button', { type: 'button', className: 'dsv-btn', onClick: () => resolvePending('discard') }, t('action.discard')),
                      h('button', { type: 'button', className: 'dsv-btn', onClick: () => resolvePending('cancel') }, t('action.cancel')))))
              : null,
            confirmDelete !== null
              ? h('div', { className: 'dsv-overlay' },
                  h('div', { className: 'dsv-dialog', role: 'alertdialog' },
                    h('div', { className: 'dsv-dialog-title' }, t('delete.title')),
                    h('div', { className: 'dsv-dialog-body' },
                      t(confirmDelete.dir ? 'delete.bodyDir' : 'delete.body', { name: confirmDelete.name })),
                    h('div', { className: 'dsv-dialog-actions' },
                      h('button', { type: 'button', className: 'dsv-btn', onClick: () => setConfirmDelete(null) }, t('action.cancel')),
                      h('button', { type: 'button', className: 'dsv-btn dsv-btn-danger', onClick: confirmDeleteNow }, t('action.delete')))))
              : null,
            dirDialog !== null
              ? h('div', { className: 'dsv-overlay' },
                  h(DirDialog, {
                    title: t('settings.title'),
                    body: t('settings.body'),
                    initial: root !== null ? root.root : '',
                    placeholder: t('settings.placeholder'),
                    saveLabel: t('action.save'),
                    onCommit: commitDir,
                    onCancel: () => setDirDialog(null),
                  }))
              : null),
        ),
      )
    }

    const CSS = `
.dsv-root { display: flex; height: 100%; width: 100%; min-height: 0; position: relative; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.dsv-tree { width: 240px; min-width: 180px; flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-specific-sidebar-fill); }
.dsv-tree-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px 8px 14px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.dsv-tree-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsv-tree-body { flex: 1; min-height: 0; overflow: auto; padding-bottom: 12px; font-size: 13px; }
.dsv-row { display: flex; align-items: center; gap: 4px; height: 24px; padding-right: 8px; cursor: pointer; white-space: nowrap; user-select: none; color: var(--dsw-alias-label-primary); }
.dsv-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsv-row-active { background: var(--dsw-alias-bg-layer-2); }
.dsv-row-label { overflow: hidden; text-overflow: ellipsis; }
.dsv-row-actions { display: inline-flex; gap: 1px; margin-left: auto; flex: none; opacity: 0; transition: opacity 80ms; }
.dsv-row:hover .dsv-row-actions, .dsv-row:focus-within .dsv-row-actions { opacity: 1; }
.dsv-row-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; flex: none; }
.dsv-row-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.dsv-row-btn:disabled { opacity: 0.45; cursor: default; }
.dsv-head-actions { display: inline-flex; gap: 1px; flex: none; }
.dsv-head-actions .dsv-row-btn { opacity: 1; }
.dsv-inline-input { flex: 1; min-width: 0; height: 20px; margin: 0; padding: 0 6px; font-size: 13px; font-family: inherit; border: 1px solid var(--dsw-alias-brand-primary); border-radius: 4px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); outline: none; }
.dsv-row-subtle { color: var(--dsw-alias-label-secondary); cursor: default; }
.dsv-row-subtle:hover { background: none; }
.dsv-row-error { color: var(--dsw-alias-state-error-primary); cursor: default; }
.dsv-row-error:hover { background: none; }
.dsv-spacer { width: 14px; flex: none; }
.dsv-ic { color: var(--dsw-alias-label-secondary); flex: none; }
.dsv-chevron { color: var(--dsw-alias-label-secondary); flex: none; }
.dsv-tree-missing { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 16px; font-size: 13px; color: var(--dsw-alias-label-secondary); text-align: center; }
.dsv-tree-missing code { font-size: 12px; color: var(--dsw-alias-label-primary); word-break: break-all; }
.dsv-editor { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dsv-tabbar { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px 0 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); flex: none; }
.dsv-tab-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsv-tab-muted { color: var(--dsw-alias-label-secondary); }
.dsv-dirty { width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); flex: none; }
.dsv-spacer-g { flex: 1; }
.dsv-btn { height: 24px; padding: 0 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; }
.dsv-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.dsv-btn:disabled { opacity: 0.45; cursor: default; }
.dsv-btn-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.dsv-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.dsv-btn-danger { background: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-bg-base); }
.dsv-btn-danger:hover:not(:disabled) { opacity: 0.9; }
.dsv-iconbtn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsv-iconbtn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsv-iconbtn:disabled { opacity: 0.45; cursor: default; }
.dsv-code { flex: 1; min-height: 0; display: flex; }
.dsv-gutter { overflow: hidden; padding: 8px 0 8px 12px; text-align: right; color: var(--dsw-alias-state-idle-primary); background: var(--dsw-alias-bg-layer-1); user-select: none; flex: none; box-sizing: border-box; }
.dsv-gutter pre { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size: 12.5px; line-height: 18px; }
.dsv-ta { flex: 1; min-width: 0; resize: none; border: 0; outline: none; padding: 8px 12px; margin: 0; background: transparent; color: var(--dsw-alias-label-primary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size: 12.5px; line-height: 18px; tab-size: 4; white-space: pre; overflow: auto; }
.dsv-status { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 14px; border-top: 1px solid var(--dsw-alias-border-l1); font-size: 12px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); flex: none; }
.dsv-status-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsv-status-error { color: var(--dsw-alias-state-error-primary); }
.dsv-status-ok { color: var(--dsw-alias-state-success-primary); }
.dsv-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--dsw-alias-label-secondary); font-size: 13px; }
.dsv-empty svg { color: var(--dsw-alias-state-idle-primary); }
.dsv-error-text { color: var(--dsw-alias-state-error-primary); }
.dsv-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.35); z-index: 10; }
.dsv-dialog { background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; padding: 16px; width: 340px; max-width: calc(100% - 32px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); }
.dsv-dialog-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.dsv-dialog-body { font-size: 13px; color: var(--dsw-alias-label-secondary); margin-bottom: 14px; word-break: break-all; }
.dsv-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dsv-dialog-field { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.dsv-dialog-wide { width: 440px; }
.dsv-inline-wide { flex: 1; }
.dsv-btn:focus-visible, .dsv-iconbtn:focus-visible, .dsv-ta:focus-visible, .dsv-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
`

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-skill-editor: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, SkillsPanel)), 'dsh-skill-editor: main panel')
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 100,
          label: () => t('panel'),
          locale: NS,
        }, SkillsPanelIcon)), 'dsh-skill-editor: sidebar entry')
      },
    }
  },
})
