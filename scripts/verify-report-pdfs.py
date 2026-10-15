"""Check the actual PDF contents and printable bounds after visual review."""
import json
import re
from pathlib import Path

import pdfplumber

root = Path(__file__).resolve().parents[1]
demo = json.loads((root / "data" / "demo-data.json").read_text(encoding="utf-8"))
reports = [root / "tmp" / "pdfs" / "Overall-College-Report-2026-09-08-DEMO.pdf", root / "tmp" / "pdfs" / "IT-Branch-Report-2026-09-08-DEMO.pdf"]
for pdf_path in reports:
    with pdfplumber.open(pdf_path) as pdf:
        assert len(pdf.pages) == 4
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        for i, page in enumerate(pdf.pages, 1):
            assert f"{i} / 4" in (page.extract_text() or "")
            for char in page.chars:
                if char.get("text", "").strip():
                    assert char["x0"] >= 25 and char["x1"] <= page.width - 25, (pdf_path.name, i, "horizontal clipping", char["text"])
                    assert char["top"] >= 12 and char["bottom"] <= page.height - 15, (pdf_path.name, i, "vertical clipping", char["text"])
        assert "DEMO / SAMPLE DATA" in text
        assert "Estimated package potential" in text
        assert "Three training priorities" in text
        for student in demo["students"]:
            assert student["name"] not in text, "Unexpected student name in aggregate report"
            assert student["uid"] not in text, "Unexpected student UID in aggregate report"
        if pdf_path.name.startswith("IT-"):
            assert "6 of 10 students" in text
            assert "IT branch only" in text
            assert not re.search(r"\b(CIVIL|CSE|MECH)\b", text), "Another branch leaked into IT report"
        else:
            assert "28 of 40 students" in text
            for branch in ["IT", "CIVIL", "CSE", "MECH"]:
                assert re.search(rf"\b{branch}\b", text)
        print(f"PASS {pdf_path.name}: 4 pages; correct scope; no student identifiers; text within print margins")
