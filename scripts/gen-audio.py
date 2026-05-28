#!/usr/bin/env python3
"""
gen-audio.py — 使用 Edge TTS 批量生成动画配音 MP3

用法:
  python3 scripts/gen-audio.py --problem P60-selection-sort
  python3 scripts/gen-audio.py --problem P60-selection-sort --voice zh-CN-XiaoxiaoNeural
  python3 scripts/gen-audio.py --all

Edge TTS 语音选项:
  zh-CN-XiaoxiaoNeural   — 晓晓 (女·温柔)
  zh-CN-XiaoshuangNeural — 晓双 (女·活泼)
  zh-CN-YunxiNeural      — 云希 (男·清朗)
  zh-CN-YunjianNeural    — 云健 (男·稳重) [默认]
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "animations" / "data"
AUDIO_DIR = PROJECT_ROOT / "animations" / "audio"

VOICES = {
    "zh-CN-XiaoxiaoNeural": "晓晓 (女·温柔)",
    "zh-CN-XiaoshuangNeural": "晓双 (女·活泼)",
    "zh-CN-YunxiNeural": "云希 (男·清朗)",
    "zh-CN-YunjianNeural": "云健 (男·稳重)",
}


def _patch_edge_tts_bitrate(compress: bool):
    """修改 edge-tts 输出码率。修改 communicate.py 后，下次 subprocess 调用生效。"""
    import edge_tts.communicate as comm_mod
    et_file = comm_mod.__file__
    with open(et_file) as f:
        src = f.read()
    hi, lo = 'audio-24khz-48kbitrate-mono-mp3', 'audio-16khz-32kbitrate-mono-mp3'
    if compress:
        if hi not in src: return  # already patched
        with open(et_file, 'w') as f:
            f.write(src.replace(hi, lo))
    else:
        if lo not in src: return  # already restored
        with open(et_file, 'w') as f:
            f.write(src.replace(lo, hi))


def gen_mp3(text: str, output_path: Path, voice: str, compress: bool = False) -> bool:
    """生成单个 MP3 文件。返回是否成功。"""
    if not text.strip():
        print("  ⚠️  文本为空，跳过")
        return False

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 压缩：先 patch 源文件，subprocess 调用时生效
    if compress:
        _patch_edge_tts_bitrate(True)

    # 调用 edge-tts CLI
    if len(text) > 500:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(text)
            tmp_path = f.name
        try:
            result = subprocess.run(
                ["edge-tts", "--voice", voice, "--file", tmp_path, "--write-media", str(output_path)],
                capture_output=True, text=True, timeout=120,
            )
        finally:
            os.unlink(tmp_path)
    else:
        result = subprocess.run(
            ["edge-tts", "--voice", voice, "--text", text, "--write-media", str(output_path)],
            capture_output=True, text=True, timeout=120,
        )

    if output_path.exists() and output_path.stat().st_size > 0:
        size_kb = output_path.stat().st_size / 1024
        print(f"  ✅ {output_path.name} ({size_kb:.1f} KB)")
        return True
    else:
        print(f"  ❌ 生成失败：{output_path.name} 为空")
        return False


def get_duration_ms(mp3_path: Path) -> int:
    """获取 MP3 时长（毫秒）。"""
    try:
        from mutagen.mp3 import MP3
        audio = MP3(mp3_path)
        if audio.info.length:
            return int(audio.info.length * 1000)
    except ImportError:
        pass

    # fallback: 用 ffprobe
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(mp3_path)],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return int(float(result.stdout.strip()) * 1000)
    except Exception:
        pass

    return 0


def process_problem(problem_id: str, voice: str, force: bool = False, compress: bool = False):
    """处理单个题目的所有 stage。"""
    json_path = DATA_DIR / f"{problem_id}.json"
    if not json_path.exists():
        print(f"❌ 数据文件不存在: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    problem_audio_dir = AUDIO_DIR / problem_id
    problem_audio_dir.mkdir(parents=True, exist_ok=True)

    title = data.get("title", problem_id)
    stages = data.get("stages", [])
    print(f"\n{'='*50}")
    print(f"📢 {title} ({problem_id})")
    print(f"   语音: {voice} — {VOICES.get(voice, '未知')}")
    print(f"   共 {len(stages)} 个阶段")
    print(f"{'='*50}")

    generated = 0
    for stage in stages:
        audio_file = stage.get("audioFile", f"stage-{stage['id']}.mp3")
        output_path = problem_audio_dir / audio_file

        if output_path.exists() and not force:
            size_kb = output_path.stat().st_size / 1024
            print(f"  ⏭  {audio_file} (已存在, {size_kb:.1f} KB)")
            generated += 1
            continue

        name = stage.get("name", f"Stage {stage['id']}")
        print(f"  🎤 {name} → {audio_file}")
        if gen_mp3(stage["narration"], output_path, voice, compress):
            generated += 1
            # 更新时长到 JSON
            duration = get_duration_ms(output_path)
            if duration:
                stage["audioDurationMs"] = duration

    # 回写 JSON（更新 audioDurationMs）
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_size = sum(
        (problem_audio_dir / f).stat().st_size
        for f in os.listdir(problem_audio_dir)
        if f.endswith(".mp3") and (problem_audio_dir / f).is_file()
    )
    print(f"\n📦 总计: {generated}/{len(stages)} 个文件, {total_size/1024:.0f} KB")
    print(f"   输出目录: {problem_audio_dir}")

    # 恢复默认码率
    if compress:
        _patch_edge_tts_bitrate(False)


def main():
    parser = argparse.ArgumentParser(description="Edge TTS 批量生成动画配音")
    parser.add_argument("--problem", "-p", help="题目 ID（如 P60-selection-sort）")
    parser.add_argument("--all", action="store_true", help="处理所有题目")
    parser.add_argument("--voice", "-v", default="zh-CN-YunjianNeural",
                        choices=list(VOICES.keys()),
                        help="Edge TTS 语音（默认: zh-CN-YunjianNeural 云健）")
    parser.add_argument("--force", "-f", action="store_true", help="强制重新生成")
    parser.add_argument("--compress", action="store_true", help="压缩到32kbps（节省33%空间）")
    args = parser.parse_args()

    # 检查 edge-tts 是否可用
    try:
        subprocess.run(["edge-tts", "--version"], capture_output=True, timeout=5)
    except FileNotFoundError:
        print("❌ 未找到 edge-tts，请先安装: pip install edge-tts")
        sys.exit(1)

    if args.all:
        json_files = sorted(DATA_DIR.glob("*.json"))
        if not json_files:
            print(f"❌ {DATA_DIR} 中没有数据文件")
            return
        for jf in json_files:
            problem_id = jf.stem
            process_problem(problem_id, args.voice, args.force, args.compress)
    elif args.problem:
        process_problem(args.problem, args.voice, args.force, args.compress)
    else:
        parser.print_help()
        print("\n示例: python3 scripts/gen-audio.py --problem P60-selection-sort")


if __name__ == "__main__":
    main()
