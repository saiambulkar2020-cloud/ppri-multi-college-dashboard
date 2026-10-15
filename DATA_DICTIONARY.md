# PPRI / PIRI Data Dictionary

## Identity and grouping

| Clean field | Excel heading | Type / rule |
| --- | --- | --- |
| UID | `UID` | Required unique text identifier |
| Batch | `BATCH` | Text; whitespace cleaned |
| Student Name | `NAME OF STUDENT` | Required text |
| Semester | `SEMESTER` | Required text |
| Branch | `BRANCH` | Required text |
| Section | `SECTION` | Required text |

`Sr No` is not used as an identifier. Completely blank records are ignored. The record count is detected dynamically.

## Assessment components

| Group | Clean field | Score rule |
| --- | --- | --- |
| General | Aptitude Score | 0–100 |
| General | Coding Score | 0–100 |
| HR & Professional Qualities | Communication Skill | 1–5 |
|  | Teamwork & Leadership | 1–5 |
|  | Ethical Values & Professional Conduct | 1–5 |
|  | Workplace Etiquette & Presentation | 1–5 |
| Psychological & Behavioural Readiness | Emotional Intelligence | 1–5 |
|  | Stress Handling & Resilience | 1–5 |
|  | Stress Tolerance | 1–5 |
|  | Adaptability & Growth Mindset | 1–5 |
| Technical Interview | Core Subject Knowledge | 1–5 |
|  | Applied Problem Solving | 1–5 |
|  | Tool Proficiency | 1–5 |
|  | Project or Mini Project Evaluation | 1–5 |
| Industry Awareness & Application Skills | External Project Development | 1–5 |
|  | Internship/Experience | 1–5 |
|  | Programming Skills/Software/Design Knowledge | 1–5 |
|  | Corporate Culture Awareness | 1–5 |

Each group contains four competencies, so each group total has a maximum of 20.

## Position-aware source mapping

| Source position / heading | Application field |
| --- | --- |
| First `TOTAL HR SCORE` | HR & Professional Qualities Total |
| Second `TOTAL HR SCORE` | Psychological & Behavioural Readiness Total |
| Third `TOTAL HR SCORE` | Technical Interview Total |
| `TOTAL TECHNICAL SCORE` | Industry Awareness & Application Skills Total |
| `STRESS TOLERENCE` | Stress Tolerance |
| `ADAPT0ILITY & GROWTH MINDSET` | Adaptability & Growth Mindset |
| `PPRI GRADES` | PPRI Grade |

The uploaded workbook is retained unchanged in private storage. Cleaning occurs only in the imported dataset.

## Outcomes

| Field | Handling |
| --- | --- |
| Total PIRI Score | Source value retained and compared with recalculation |
| PIRI | Source value retained and compared with weighted recalculation |
| PPRI Grade | Source value retained and compared with recalculated grade |
| Estimated Package | Source band retained; calculated fallback only if missing |
| Result | Blank becomes `Result Not Available`; no PASS/FAIL rule is invented |
| Remark | Source text retained |
| Review | Source text retained; repeated generic text is counted in Data Quality |

## Validation calculations

**Total PIRI Score**

`Aptitude + Coding + HR Total + Psychological Total + Technical Total + Industry Total`

**PIRI**

`ROUND(((Aptitude × 0.20) + (Coding × 0.25) + (HR × 0.15) + (Psychological × 0.15) + (Technical × 0.15) + (Industry × 0.10)) ÷ 5, 2)`

**Grades**

| Minimum PIRI | Grade |
| ---: | :--- |
| 9.5 | A+ |
| 9.0 | A |
| 8.5 | B+ |
| 8.0 | B |
| 7.5 | C+ |
| 7.0 | C |
| 6.0 | D |
| Below 6.0 | F |

Admins may change weights and thresholds in Dashboard Settings. Weights must total 100%.

## Database tables

| Table | Purpose |
| --- | --- |
| `profiles` | Authenticated user profile and `admin` / `viewer` role |
| `dashboard_settings` | One editable JSON settings record |
| `dataset_versions` | Filename, private storage path, owner, counts, quality summary, mapping and active state |
| `student_records` | Dataset-scoped indexed student records plus complete validated JSON |
| `upload_history` | Success/failure audit trail |
| `data_quality_results` | Optional detailed dataset check results |

The `activate_dataset` database function changes the active version only after student records exist and the import is complete.
