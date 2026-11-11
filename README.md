# dsh-skill-editor

Browse and edit the skills directory from a VSCode-style file tree and editor
panel in the DSH web client sidebar.

## Features

- File tree of the configured skills directory, expandable directory by
  directory; files open in a Monaco-style editor panel.
- Create, rename, and delete files and directories from the tree.
- Read and save `SKILL.md` and other text files; reads and saves above a size
  cap are refused.
- Panel-wide directory switch: the served root can be changed from the panel
  and persists through the profile's config editor.
- English and Chinese UI copy via the client locale system.

## Install

```sh
dsh plugin add github:komorebi-c9/dsh-skill-editor
```

## Configuration

The plugin serves one directory, default `~/.agents/skills` (`~` expands to
the home directory). Set it in `cordis.yml`:

```yaml
plugins:
  - id: dsh-skill-editor
    config:
      dir: '~/.agents/skills'
```

## Security

Every path is resolved against the configured root and must stay inside it;
the route never sees absolute paths or parent references. File access runs
inside the Connection's authentication fence.

## License

MIT
