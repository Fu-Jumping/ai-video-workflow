# jycrypto：剪映草稿加解密小工具（D3）

`roughcut draft` 用它把程序构造的明文草稿 JSON 加密成剪映 11.6.0 可读的密文，
也用它把密文解回明文做自检。原理不是破解算法，而是调用剪映安装目录自带的
`videoeditor.dll` 中导出的 `lvve::EncryptUtils` 加解密函数（密钥由引擎管理并嵌入密文文件，
全程离线）。研究结论与完整调用规格见 `docs/context-engineering/07-decisions-and-open-questions.md` D17。

## 版本绑定

| 项 | 值 |
| --- | --- |
| 已验证剪映版本 | 11.6.0.14552（结构版本 `189.0.0`） |
| videoeditor.dll SHA-256 | `8CFCBB612CCD946DF974428977B1902736C1DE0AE561E20C26CBD4EA86099CB1` |
| 参考实现 | wenshui330/jy-draftc（MIT，仅借鉴调用方式，本文件为独立实现） |

剪映升级后指纹不匹配时，CLI 侧会明确报错拒绝生成，需要按同一原理重新适配。

## 重新编译（Windows x64，MinGW-w64）

    g++ -std=c++17 -O2 -o win-x64/jycrypto.exe jycrypto.cpp

MSVC（cl）同样可编译；不要链接动态 CRT（`/MT` 或 MinGW 默认静态），避免把其他版本的
msvcp140/vcruntime140 带进进程导致引擎惰性静态初始化损坏（见源码内注释）。

## 运行契约（CLI 依赖的稳定接口）

- 环境变量 `JY_DIR`：剪映版本目录（含 `videoeditor.dll` 与自带 CRT）；未设时用编译期默认路径。
- `jycrypto self`：加密自检，stdout 含 `match=1` 表示引擎可用。
- `jycrypto dec <in> <out>`：解密文件；stdout 含 `ok=1`。
- `jycrypto enc <in> <out>`：加密文件（明文必须是含 `id`/`new_version` 的合法草稿 JSON）；
  stdout 含 `roundtrip=1` 表示加密后解密回读与明文一致，CLI 以此判定成功。
- `jycrypto rt <in> [out]`：往返自检。
- 引擎加载后进程不做 FreeLibrary，统一以 `TerminateProcess` 退出——因此本工具只能按
  「每次调用一个子进程」的方式使用（这正是 `roughcut draft` 的选型，见 D17）。
