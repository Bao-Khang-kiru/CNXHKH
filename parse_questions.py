#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parse CNXHKH multiple-choice questions from Markdown file.
Outputs questions.json with proper format for the web app.
"""

import re
import json
import os

# Input file path
INPUT_FILE = r"d:\TaiLieu\Đề cương\CNXHKH\trắc nghiệm_blank.docx.md"
# Output file path
OUTPUT_FILE = r"d:\TaiLieu\Đề cương\CNXHKH\web-app\questions.json"

# Chapter name mapping
CHAPTER_NAMES = {
    1: "Nhập môn Chủ nghĩa xã hội khoa học",
    2: "Sứ mệnh lịch sử của giai cấp công nhân",
    3: "Chủ nghĩa xã hội và thời kỳ quá độ lên chủ nghĩa xã hội",
    4: "Dân chủ xã hội chủ nghĩa và nhà nước xã hội chủ nghĩa",
    5: "Cơ cấu xã hội - giai cấp và liên minh giai cấp, tầng lớp trong thời kỳ quá độ lên chủ nghĩa xã hội",
    6: "Vấn đề dân tộc và tôn giáo trong thời kỳ quá độ lên chủ nghĩa xã hội",
    7: "Vấn đề gia đình trong thời kỳ quá độ lên chủ nghĩa xã hội",
}

# Stop line: fill-in-blank section begins at line 2404
STOP_LINE = 2403  # 0-indexed


def clean_text(text):
    """Remove escape characters and extra whitespace."""
    # Remove backslash escapes
    text = text.replace("\\-", "-")
    text = text.replace("\\!", "!")
    text = text.replace("\\'", "'")
    text = re.sub(r"\\(.)", r"\1", text)
    # Remove trailing whitespace and tab characters
    text = text.strip().rstrip("\\").strip()
    # Collapse multiple spaces
    text = re.sub(r"  +", " ", text)
    return text


def remove_bold(text):
    """Remove bold markdown markers."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.DOTALL)


def is_bold(text):
    """Check if the text is wrapped in bold markdown."""
    stripped = text.strip()
    return stripped.startswith("**") and stripped.endswith("**")


def parse_option_text(text, bold_markers=False):
    """
    Parse option text, removing option prefix (A. B. C. D.) 
    and bold markers. Return (clean_text, is_correct).
    """
    # Check if this option is correct (has bold markers)
    correct = is_bold(text.strip())
    # Remove bold markers
    text = re.sub(r"\*\*", "", text)
    # Remove option prefix: A. / B. / C. / D.
    text = re.sub(r"^[A-Da-d]\.\s*", "", text.strip())
    text = clean_text(text)
    return text, correct


def parse_questions(filepath, stop_line):
    """Parse questions from the markdown file."""
    with open(filepath, encoding="utf-8") as f:
        lines = f.readlines()

    questions = []
    current_chapter = 0
    current_chapter_name = ""

    i = 0
    question_id = 0

    while i < min(len(lines), stop_line):
        line = lines[i].rstrip("\n")

        # Detect chapter header: ## CHƯƠNG X:
        chapter_match = re.match(r"^##\s+\**CHƯƠNG\s+(\d+)[:\s]", line, re.IGNORECASE)
        if chapter_match:
            current_chapter = int(chapter_match.group(1))
            current_chapter_name = CHAPTER_NAMES.get(current_chapter, f"Chương {current_chapter}")
            i += 1
            continue

        # Detect question: "Câu N:" or "Câu N."
        q_match = re.match(r"^Câu\s+\d+\s*[:.]\s*(.+)", line)
        if q_match:
            # Collect question text (may span multiple lines until blank line or option line)
            question_text = q_match.group(1).strip()
            # Continue collecting question text on next lines if they don't start an option
            j = i + 1
            while j < min(len(lines), stop_line):
                next_line = lines[j].rstrip("\n").strip()
                # Stop if blank line or option line
                if not next_line:
                    break
                if re.match(r"^[\*]*[A-Da-d][\.\s]", next_line):
                    break
                # It's a continuation of the question
                question_text += " " + next_line
                j += 1

            question_text = clean_text(remove_bold(question_text))
            # Skip empty question
            if not question_text:
                i = j
                continue

            # Now parse the 4 options
            # Collect option lines
            options_raw = []
            k = j
            while k < min(len(lines), stop_line) and len(options_raw) < 4:
                opt_line = lines[k].rstrip("\n").strip()
                if not opt_line:
                    k += 1
                    continue
                # Is this an option line? (A/B/C/D possibly bold)
                opt_match = re.match(r"^(\*\*)?[A-Da-d][.\s]", opt_line)
                if opt_match:
                    # Collect full option (may span multiple lines)
                    full_opt = opt_line
                    m = k + 1
                    while m < min(len(lines), stop_line):
                        next_opt = lines[m].rstrip("\n").strip()
                        if not next_opt:
                            break
                        # Next option starts
                        if re.match(r"^(\*\*)?[A-Da-d][.\s]", next_opt):
                            break
                        # New question starts
                        if re.match(r"^Câu\s+\d+", next_opt):
                            break
                        # Chapter header
                        if re.match(r"^##", next_opt):
                            break
                        full_opt += " " + next_opt
                        m += 1
                    options_raw.append(full_opt)
                    k = m
                else:
                    # Not an option line - stop collecting
                    break

            # We need exactly 4 options
            if len(options_raw) != 4:
                # Skip this question
                i = k
                continue

            # Parse options and find correct answer
            parsed_options = []
            correct_index = -1
            for idx, raw in enumerate(options_raw):
                opt_text, is_correct = parse_option_text(raw)
                parsed_options.append(opt_text)
                if is_correct:
                    correct_index = idx

            # Skip if no correct answer found
            if correct_index == -1:
                # Try to find bold in full option text
                for idx, raw in enumerate(options_raw):
                    if "**" in raw:
                        correct_index = idx
                        break

            if correct_index == -1:
                i = k
                continue

            question_id += 1
            questions.append({
                "id": question_id,
                "chapter": current_chapter,
                "chapter_name": current_chapter_name,
                "question": question_text,
                "options": parsed_options,
                "correct": correct_index,
                "keywords": []
            })

            i = k
            continue

        i += 1

    return questions


def main():
    print(f"Parsing: {INPUT_FILE}")
    questions = parse_questions(INPUT_FILE, STOP_LINE)
    print(f"Total questions parsed: {len(questions)}")

    # Validate
    valid = []
    issues = []
    for q in questions:
        if len(q["options"]) != 4:
            issues.append(f"Q{q['id']}: wrong option count ({len(q['options'])})")
            continue
        if q["correct"] < 0 or q["correct"] > 3:
            issues.append(f"Q{q['id']}: invalid correct index ({q['correct']})")
            continue
        valid.append(q)

    if issues:
        print(f"\nISSUES ({len(issues)}):")
        for iss in issues[:20]:
            print(" ", iss)

    print(f"\nValid questions: {len(valid)}")
    for ch in range(1, 8):
        count = sum(1 for q in valid if q["chapter"] == ch)
        print(f"  Chapter {ch}: {count} questions")

    # Write output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(valid, f, ensure_ascii=False, indent=2)

    print(f"\nOutput written to: {OUTPUT_FILE}")
    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
