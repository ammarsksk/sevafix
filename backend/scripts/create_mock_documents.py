"""Generate dependency-free, visibly fictional PDF fixtures for the SevaFix demo."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
WARNING = "FICTIONAL TEST DOCUMENT - NOT VALID FOR OFFICIAL USE"
STUDENT = "Aarav Mehta"


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf(filename: str, issuer: str, title: str, rows: list[tuple[str, str]], notes: list[str], *, fault: str | None = None) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    commands = [
        "q", "0.98 0.90 0.90 rg", "36 738 540 34 re f", "Q",
        "BT", "/F2 11 Tf", "0.65 0.05 0.05 rg", "54 751 Td", f"({_escape(WARNING)}) Tj", "ET",
        "BT", "/F2 14 Tf", "0.08 0.18 0.27 rg", "54 708 Td", f"({_escape(issuer)}) Tj", "ET",
        "BT", "/F2 20 Tf", "0.05 0.30 0.42 rg", "54 674 Td", f"({_escape(title)}) Tj", "ET",
        "0.10 0.35 0.45 RG", "1.3 w", "54 658 m 558 658 l S",
    ]
    y = 626
    for label, value in rows:
        commands.extend([
            "BT", "/F2 10 Tf", "0.25 0.31 0.36 rg", f"54 {y} Td", f"({_escape(label + ':')}) Tj", "ET",
            "BT", "/F1 11 Tf", "0.08 0.12 0.17 rg", f"205 {y} Td", f"({_escape(value)}) Tj", "ET",
            "0.82 0.85 0.88 RG", "0.5 w", f"54 {y - 7} m 558 {y - 7} l S",
        ])
        y -= 34
    if fault:
        commands.extend([
            "q", "1.0 0.94 0.94 rg", f"54 {y - 8} 504 42 re f", "Q",
            "BT", "/F2 9 Tf", "0.70 0.05 0.05 rg", f"66 {y + 8} Td", f"({_escape(fault)}) Tj", "ET",
        ])
        y -= 58
    for note in notes:
        commands.extend(["BT", "/F1 9 Tf", "0.32 0.38 0.43 rg", f"54 {y} Td", f"({_escape(note)}) Tj", "ET"])
        y -= 18
    commands.extend([
        "0.82 0.85 0.88 RG", "0.6 w", "54 46 m 558 46 l S",
        "BT", "/F2 8 Tf", "0.65 0.05 0.05 rg", "54 30 Td", f"({_escape(WARNING)}) Tj", "ET",
    ])
    stream = "\n".join(commands).encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    result = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result.extend(f"{number} 0 obj\n".encode("ascii"))
        result.extend(obj)
        result.extend(b"\nendobj\n")
    xref = len(result)
    result.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    result.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    result.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    path = OUTPUT_DIR / filename
    path.write_bytes(result)
    return path


def main() -> None:
    documents = [
        _pdf(
            "sevafix_mock_class_xii_marksheet.pdf", "DEMONSTRATION BOARD OF SCHOOL EDUCATION", "Class XII Statement of Marks",
            [("Applicant Name", STUDENT), ("Date of Birth", "18 April 2007"), ("Academic Year", "2024-2025"),
             ("Board Percentile", "92.0"), ("Aggregate", "465 / 500 - 93 percent"), ("Result", "PASS"),
             ("Test Roll Number", "MOCK-2025-12047")],
            ["Synthetic assessment record created only for OCR and eligibility-check testing."],
        ),
        _pdf(
            "sevafix_mock_income_certificate_FAULTY.pdf", "OFFICE OF THE DEMONSTRATION REVENUE OFFICER", "Family Income Certificate - Faulty Demo Version",
            [("Applicant Name", STUDENT), ("Parent or Guardian", "Rohan Mehta - fictional"), ("Financial Year", "2024-2025"),
             ("Annual Family Income", "INR 900000"), ("Certificate Reference", "TEST-INC-2025-ERROR"), ("Issue Date", "15 June 2025")],
            ["No government database was queried. All names, offices and identifiers are fictional."],
            fault="DELIBERATE DEMO FAULT: form income is INR 350000; this certificate says INR 900000.",
        ),
        _pdf(
            "sevafix_mock_income_certificate_CORRECTED.pdf", "OFFICE OF THE DEMONSTRATION REVENUE OFFICER", "Family Income Certificate - Corrected Demo Version",
            [("Applicant Name", STUDENT), ("Parent or Guardian", "Rohan Mehta - fictional"), ("Financial Year", "2024-2025"),
             ("Annual Family Income", "INR 350000"), ("Certificate Reference", "TEST-INC-2025-CORRECTED"), ("Issue Date", "16 June 2025")],
            ["Corrected synthetic fixture. No government database was queried."],
        ),
        _pdf(
            "sevafix_mock_admission_letter.pdf", "NATIONAL INSTITUTE OF TEST STUDIES", "Provisional Admission Letter",
            [("Applicant Name", STUDENT), ("Institution Name", "National Institute of Test Studies"),
             ("Course Name", "Bachelor of Science - Computer Science"), ("Course Type", "Degree"), ("Enrolment Mode", "Regular"),
             ("Current Course Year", "1"), ("AISHE Code", "C-99999 - synthetic"), ("Academic Year", "2025-2026")],
            ["The institution and AISHE code are deliberately fictional. This is not an admission offer."],
        ),
        _pdf(
            "sevafix_mock_identity_proof.pdf", "SEVAFIX DEMONSTRATION IDENTITY REGISTRY", "Synthetic Student Identity Certificate",
            [("Applicant Name", STUDENT), ("Date of Birth", "18 April 2007"), ("Test Identifier", "SF-DEMO-ID-000184"),
             ("Purpose", "OCR and name consistency testing")],
            ["NOT AADHAAR. NOT PAN. NOT A GOVERNMENT ID. Contains no real identity number."],
        ),
    ]
    for document in documents:
        print(document)


if __name__ == "__main__":
    main()
