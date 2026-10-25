// jycrypto: 剪映 11.6 草稿加解密 CLI。用法:
//   jycrypto dec <in> <out>   解密(密文文本文件 -> 明文json)
//   jycrypto enc <in> <out>   加密(明文json -> 密文文本)
//   jycrypto rt  <in>         往返自检
//   jycrypto self             加密自检
#include <windows.h>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <fstream>

using DecryptWithFlag = void *(*)(void *, void *, const void *, const void *, void *);
using Encrypt = void *(*)(void *, void *, const void *);
using Enable = void (*)(void *, bool);

struct MSS {
    unsigned char b[32]; unsigned char *heap = nullptr;
    void set(const void *data, uint64_t n) {
        memset(b, 0, 32);
        if (n <= 15) { memcpy(b, data, (size_t)n); put64(16, n); put64(24, 15); }
        else { heap = new unsigned char[(size_t)n + 1]; memcpy(heap, data, (size_t)n); heap[n] = 0;
               put64(0, (uint64_t)(uintptr_t)heap); put64(16, n); put64(24, n); }
    }
    void put64(int off, uint64_t v) { memcpy(b + off, &v, 8); }
    uint64_t get64(int off) { uint64_t v; memcpy(&v, b + off, 8); return v; }
    std::string str() {
        uint64_t n = get64(16), cap = get64(24);
        if (cap < 16) return std::string((char *)b, (size_t)n);
        uint64_t p; memcpy(&p, b, 8);
        return std::string((char *)(uintptr_t)p, (size_t)n);
    }
};

static std::string read_text(const char *p) {
    std::ifstream s(p, std::ios::binary);
    return std::string((std::istreambuf_iterator<char>(s)), std::istreambuf_iterator<char>());
}
static void write_text(const char *p, const std::string &t) {
    {   // 建父目录（仅一层；调用方保证层级）
        std::wstring dir;
        const char *last = nullptr;
        for (const char *q = p; *q; ++q) if (*q == '\\' || *q == '/') last = q;
        if (last) {
            for (const char *r = p; r != last; ++r) dir.push_back((wchar_t)(unsigned char)*r);
            ::CreateDirectoryW(dir.c_str(), nullptr);
        }
    }
    std::ofstream s(p, std::ios::binary | std::ios::trunc);
    if (!s) { printf("[x] write open fail: %s\n", p); return; }
    s.write(t.data(), (std::streamsize)t.size());
}
static std::wstring to_w(const char *p) { std::wstring w; for (; *p; ++p) w.push_back((wchar_t)(unsigned char)*p); return w; }

static std::wstring g_prev_cwd;
static HMODULE load_engine() {
    const char *jydir = getenv("JY_DIR");
    if (!jydir) jydir = "E:\\software\\media\\jianying\\JianyingPro\\11.6.0.14552";
    std::wstring wdir = to_w(jydir);
    {
        std::wstring cwd(32768, L'\0');
        DWORD n = ::GetCurrentDirectoryW((DWORD)cwd.size(), cwd.data());
        if (n > 0 && n < cwd.size()) g_prev_cwd.assign(cwd.c_str(), n);
    }
    ::SetCurrentDirectoryW(wdir.c_str());
    ::AddDllDirectory(wdir.c_str());
    const wchar_t *crts[] = {L"vcruntime140.dll", L"vcruntime140_1.dll", L"vcruntime140_threads.dll",
                             L"msvcp140.dll", L"msvcp140_1.dll", L"msvcp140_2.dll",
                             L"msvcp140_atomic_wait.dll"};
    for (const wchar_t *c : crts)
        ::LoadLibraryExW((wdir + L"\\" + c).c_str(), nullptr,
                         LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
    HMODULE m = ::LoadLibraryExW((wdir + L"\\videoeditor.dll").c_str(), nullptr,
                            LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32 |
                                LOAD_LIBRARY_SEARCH_USER_DIRS);
    if (!g_prev_cwd.empty()) ::SetCurrentDirectoryW(g_prev_cwd.c_str());
    return m;
}

int main(int argc, char **argv) {
    setvbuf(stdout, NULL, _IONBF, 0);
    if (argc < 2) { printf("usage: jycrypto dec|enc|rt|self <in> [out]\n"); return 64; }
    std::string mode = argv[1];
    HMODULE m = load_engine();
    if (!m) { printf("[x] videoeditor load fail gle=%lu\n", ::GetLastError()); return 8; }
    auto with_flag = (DecryptWithFlag)::GetProcAddress(m,
        "?decrypt@EncryptUtils@lvve@@QEAA?AV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@"
        "std@@AEBV34@0AEA_N@Z");
    auto enc = (Encrypt)::GetProcAddress(m,
        "?encrypt@EncryptUtils@lvve@@QEAA?AV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@"
        "std@@AEBV34@@Z");
    auto enb = (Enable)::GetProcAddress(m, "?enable@EncryptUtils@lvve@@QEAAX_N@Z");
    if (!with_flag || !enc || !enb) { printf("[x] exports missing\n"); return 9; }
    MSS param; param.set("{}", 2);

    auto decrypt = [&](const std::string &s, bool *ok) {
        MSS in; in.set(s.data(), s.size());
        MSS out; memset(out.b, 0, 32);
        bool good = false;
        with_flag(nullptr, &out, &in, &param, &good);
        if (ok) *ok = good;
        return out.str();
    };
    auto encrypt = [&](const std::string &s) {
        enb(nullptr, true);
        MSS in; in.set(s.data(), s.size());
        MSS out; memset(out.b, 0, 32);
        enc(nullptr, &out, &in);
        return out.str();
    };

    if (mode == "self") {
        std::string sample =
            "{\"id\":\"11111111-2222-3333-4444-555555555555\",\"version\":360000,\"new_version\":\"189.0.0\","
            "\"duration\":0,\"color_space\":0,\"config\":{},\"canvas_config\":{\"width\":720,\"height\":1280},"
            "\"tracks\":[],\"materials\":{},\"keyframes\":{},\"extra_info\":{}}";
        std::string e = encrypt(sample);
        bool ok = false; std::string b = decrypt(e, &ok);
        printf("self: %zu -> %zu -> %zu match=%d ok=%d\n", sample.size(), e.size(), b.size(), b == sample, (int)ok);
        fflush(stdout); fflush(stderr);
        ::TerminateProcess(::GetCurrentProcess(), b == sample ? 0 : 11);
    }
    if (argc < 3) { printf("[x] need input\n"); return 64; }
    std::string src = read_text(argv[2]);
    if (src.empty()) { printf("[x] read fail: %s\n", argv[2]); return 1; }
    const char *outp = argc > 3 ? argv[3] : nullptr;

    if (mode == "dec" || mode == "rt") {
        bool ok = false;
        std::string plain = decrypt(src, &ok);
        if (plain.empty()) { printf("[x] decrypt empty ok=%d\n", (int)ok); return 11; }
        printf("[dec] %zu -> %zu ok=%d\n", src.size(), plain.size(), (int)ok);
        if (mode == "dec") {
            if (!outp) { printf("%s", plain.c_str()); }
            else write_text(outp, plain);
        } else {
            std::string e = encrypt(plain);
            bool ok2 = false; std::string b2 = decrypt(e, &ok2);
            printf("[rt] enc=%zu roundtrip=%d ok=%d\n", e.size(), b2 == plain, (int)ok2);
            if (outp) write_text(outp, e);
        }
    } else if (mode == "enc") {
        std::string e = encrypt(src);
        if (e.empty()) { printf("[x] encrypt empty (not draft json?)\n"); return 11; }
        bool ok = false; std::string b = decrypt(e, &ok);
        printf("[enc] %zu -> %zu roundtrip=%d ok=%d\n", src.size(), e.size(), b == src, (int)ok);
        if (outp) write_text(outp, e);
    } else { printf("[x] bad mode\n"); return 64; }
    fflush(stdout); fflush(stderr);
    ::TerminateProcess(::GetCurrentProcess(), 0);
    return 0;
}
