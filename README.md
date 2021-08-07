# coc-denoland

[![](https://img.shields.io/npm/v/coc-denoland?style=flat-square)](https://www.npmjs.com/package/coc-denoland)
[![](https://img.shields.io/bundlephobia/min/coc-denoland?style=flat-square)](https://www.npmjs.com/package/coc-denoland)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)

This repository's goal is porting [`vscode_deno`](https://github.com/denoland/vscode_deno) to `coc.nvim`, so making it less diff.

Versioning policy is perfectly separated from [`vscode_deno`](https://github.com/denoland/vscode_deno) and `deno`.

Diff to original: https://github.com/denoland/vscode_deno/compare/main...LumaKernel:main

## Installation

1. `CocInstall coc-denoland`
2. Configure following by `CocConfig` or `CocLocalConfig` in your deno project.

```json
{
  "deno.enable": true,
  "tsserver.enable": false
}
```

Most changes and feature enhancements do not require changes to the extension
though, as most information comes from the Deno Language Server itself, which is
integrated into the Deno CLI. Please check out the
[contribution guidelines](https://github.com/denoland/deno/tree/master/docs/contributing)
for the Deno CLI.

## Credits

- [`vscode_deno`](https://github.com/denoland/vscode_deno): The origin of this repository. Forked under the MIT license.
- [yaegassy](https://github.com/yaegassy) let me know how to make coc plugins.
- [yuki-yano](https://github.com/yuki-yano) shared me an ideas to implement coc.nvim specific.
