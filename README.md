# ADB Helper

A right-sidebar panel. It runs in a sandboxed frame and calls host methods its `capabilities` allow through `window.orca`. Loading it needs approval: `orca plugin dev watch .` prints the exact access and the `--approve` fingerprint.

## Develop

```sh
orca plugin validate .
orca plugin dev watch .    # loads this folder into Orca and prints its logs and reloads; Ctrl-C unloads it
```

Orca names the publisher after where the plugin is installed from: the GitHub or GitLab owner of
its repository, or `local` for a folder. See
https://github.com/stablyai/orca/blob/main/docs/reference/plugin-authoring.md.
