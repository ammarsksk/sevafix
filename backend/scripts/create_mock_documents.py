"""Create synthetic, visibly invalid documents for the SevaFix PM-USP demo flow.

These documents are test fixtures only. They contain no real identity numbers and
must never be presented to a government authority.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
WARNING = "FICTIONAL TEST DOCUMENT - NOT VALID FOR OFFICIAL USE"
STUDENT = "Aarav Mehta"
DOB = "18 April 2007"
INSTITUTION = "National Institute of Test Studies"
AISHE_CODE = "C-99999 (SYNTHETIC)"


def register_fonts() -> tuple[str, str]:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("MockSans", str(regular)))
        pdfmetrics.registerFont(TTFont("MockSans-Bold", str(bold)))
        return "MockSans", "MockSans-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def styles():
    base = getSampleStyleSheet()
    return {
        "warning": ParagraphStyle(
            "Warning",
            parent=base["Normal"],
            fontName=FONT_BOLD,
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#991B1B"),
        ),
        "issuer": ParagraphStyle(
            "Issuer",
            parent=base["Normal"],
            fontName=FONT_BOLD,
            fontSize=15,
            leading=18,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0F172A"),
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
        ),
        "title": ParagraphStyle(
            "Title",
            parent=base["Normal"],
            fontName=FONT_BOLD,
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            spaceAfter=4 * mm,
            textColor=colors.HexColor("#0F3D5E"),
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=10,
            leading=15,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#1E293B"),
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#64748B"),
        ),
        "right": ParagraphStyle(
            "Right",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=9,
            leading=12,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#334155"),
        ),
    }


STYLES = styles()


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.setFont(FONT_BOLD, 8)
    canvas.setFillColor(colors.HexColor("#991B1B"))
    canvas.drawString(20 * mm, 10 * mm, WARNING)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawRightString(190 * mm, 10 * mm, f"SevaFix mock run | Page {doc.page}")
    canvas.restoreState()


def header(issuer: str, subtitle: str, title: str):
    return [
        Table(
            [[Paragraph(WARNING, STYLES["warning"]) ]],
            colWidths=[170 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEE2E2")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#EF4444")),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            ),
        ),
        Spacer(1, 7 * mm),
        Paragraph(issuer, STYLES["issuer"]),
        Paragraph(subtitle, STYLES["subtitle"]),
        Spacer(1, 3 * mm),
        HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F3D5E")),
        Spacer(1, 6 * mm),
        Paragraph(title, STYLES["title"]),
    ]


def key_value_table(rows, widths=(55 * mm, 115 * mm)):
    formatted = [[Paragraph(str(k), STYLES["small"]), Paragraph(str(v), STYLES["body"])] for k, v in rows]
    return Table(
        formatted,
        colWidths=list(widths),
        hAlign="LEFT",
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        ),
    )


def build(filename: str, story):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_DIR / filename),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=23 * mm,
        title=filename.removesuffix(".pdf").replace("_", " ").title(),
        author="SevaFix synthetic test fixture generator",
        subject=WARNING,
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def marksheet():
    story = header(
        "DEMONSTRATION BOARD OF SCHOOL EDUCATION",
        "Synthetic assessment record for software testing",
        "Class XII Statement of Marks",
    )
    story += [
        key_value_table(
            [
                ("Candidate", STUDENT),
                ("Date of birth", DOB),
                ("Test roll number", "MOCK-2025-12047"),
                ("Academic session", "2024-2025"),
                ("School", "SevaFix Demonstration Senior Secondary School"),
            ]
        ),
        Spacer(1, 7 * mm),
    ]
    rows = [
        ["Subject", "Theory", "Practical", "Total", "Result"],
        ["English Core", "88", "--", "88", "PASS"],
        ["Physics", "67", "28", "95", "PASS"],
        ["Chemistry", "65", "29", "94", "PASS"],
        ["Mathematics", "93", "--", "93", "PASS"],
        ["Computer Science", "66", "29", "95", "PASS"],
    ]
    marks = Table(rows, colWidths=[62 * mm, 27 * mm, 27 * mm, 25 * mm, 29 * mm])
    marks.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F3D5E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story += [
        marks,
        Spacer(1, 7 * mm),
        key_value_table(
            [
                ("Aggregate", "465 / 500 (93.0%)"),
                ("Board percentile", "92.0"),
                ("Result", "PASS"),
                ("Issue date", "30 May 2025"),
            ]
        ),
        Spacer(1, 10 * mm),
        Paragraph(
            "This record was generated solely to test SevaFix document upload, OCR, name consistency, and eligibility checks. It has no academic or legal validity.",
            STYLES["body"],
        ),
    ]
    build("sevafix_mock_class_xii_marksheet.pdf", story)


def income_certificate():
    story = header(
        "OFFICE OF THE DEMONSTRATION REVENUE OFFICER",
        "Mock District, Test State - synthetic e-governance fixture",
        "Family Income Certificate",
    )
    story += [
        Paragraph(
            "This is to certify, for software demonstration purposes only, that the gross annual family income associated with the fictional student below is recorded as follows:",
            STYLES["body"],
        ),
        Spacer(1, 6 * mm),
        key_value_table(
            [
                ("Student name", STUDENT),
                ("Parent / guardian", "Rohan Mehta (fictional)"),
                ("Address", "42 Test Avenue, Mock District, Test State 000000"),
                ("Financial year", "2024-2025"),
                ("Gross annual family income", "INR 3,00,000 (Rupees Three Lakh Only)"),
                ("Certificate reference", "TEST-INC-2025-00418"),
                ("Issue date", "15 June 2025"),
                ("Valid through", "14 June 2026"),
            ]
        ),
        Spacer(1, 10 * mm),
        Table(
            [[Paragraph("Digitally unsigned synthetic fixture", STYLES["small"]), Paragraph("Demonstration Revenue Officer", STYLES["right"]) ]],
            colWidths=[85 * mm, 85 * mm],
        ),
        Spacer(1, 12 * mm),
        Paragraph(
            "No government database was queried to create this file. All people, identifiers, addresses, seals, and offices shown here are fictional.",
            STYLES["body"],
        ),
    ]
    build("sevafix_mock_income_certificate.pdf", story)


def admission_letter():
    story = header(
        INSTITUTION.upper(),
        "Synthetic institution created for the SevaFix demonstration",
        "Provisional Admission Letter",
    )
    story += [
        Paragraph("Dear Aarav Mehta,", STYLES["body"]),
        Spacer(1, 3 * mm),
        Paragraph(
            "For this fictional software test, you are shown as provisionally admitted to the first year of a regular undergraduate degree programme for the 2025-2026 academic session.",
            STYLES["body"],
        ),
        Spacer(1, 7 * mm),
        key_value_table(
            [
                ("Applicant", STUDENT),
                ("Programme", "Bachelor of Science (Computer Science)"),
                ("Course type", "Degree"),
                ("Enrolment mode", "Regular"),
                ("Current course year", "1"),
                ("Institution", INSTITUTION),
                ("AISHE code", AISHE_CODE),
                ("Recognition status", "Recognized - synthetic test assertion"),
                ("AISHE status", "Active - synthetic test assertion"),
                ("Test admission number", "NITS-MOCK-25-0184"),
                ("Letter date", "20 July 2025"),
            ]
        ),
        Spacer(1, 10 * mm),
        Paragraph(
            "This letter does not offer admission to any real institution. The institution name and AISHE code are deliberately synthetic and must not be used outside this mock run.",
            STYLES["body"],
        ),
    ]
    build("sevafix_mock_admission_letter.pdf", story)


def identity_proof():
    story = header(
        "SEVAFIX DEMONSTRATION IDENTITY REGISTRY",
        "Non-government identity-consistency fixture",
        "Synthetic Student Identity Certificate",
    )
    story += [
        Table(
            [
                [
                    Table(
                        [[Paragraph("TEST<br/>PHOTO<br/>AREA", STYLES["warning"]) ]],
                        colWidths=[36 * mm],
                        rowHeights=[46 * mm],
                        style=TableStyle(
                            [
                                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94A3B8")),
                                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ]
                        ),
                    ),
                    key_value_table(
                        [
                            ("Name", STUDENT),
                            ("Date of birth", DOB),
                            ("Test identifier", "SF-DEMO-ID-000184"),
                            ("Purpose", "OCR and name consistency testing"),
                        ],
                        widths=(40 * mm, 90 * mm),
                    ),
                ]
            ],
            colWidths=[40 * mm, 130 * mm],
            style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]),
        ),
        Spacer(1, 10 * mm),
        Table(
            [[Paragraph("NOT AADHAAR", STYLES["warning"]), Paragraph("NOT PAN", STYLES["warning"]), Paragraph("NOT GOVERNMENT ID", STYLES["warning"]) ]],
            colWidths=[56.7 * mm, 56.7 * mm, 56.6 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#F97316")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#FDBA74")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            ),
        ),
        Spacer(1, 9 * mm),
        Paragraph(
            "This certificate intentionally contains no Aadhaar number, PAN, bank account, QR code, biometric, signature, or real government identifier. It exists only to test whether the same fictional name appears across documents.",
            STYLES["body"],
        ),
    ]
    build("sevafix_mock_identity_proof.pdf", story)


def main():
    marksheet()
    income_certificate()
    admission_letter()
    identity_proof()
    for path in sorted(OUTPUT_DIR.glob("sevafix_mock_*.pdf")):
        print(path)


if __name__ == "__main__":
    main()
