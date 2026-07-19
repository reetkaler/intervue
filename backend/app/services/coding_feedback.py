from anthropic import Anthropic

from app.config import settings
from app.models.schemas import CodingFeedback, SubmissionResult

client = Anthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = (
    "You are a technical interviewer scoring a candidate's mock coding interview. "
    "You are given the problem, a transcript of the candidate explaining their "
    "approach out loud while solving it, their submitted code, and the actual "
    "test results from running that code. "
    "Score holistically: both how clearly they communicated their reasoning "
    "AND whether their code actually worked. A clear explanation with a bug is "
    "not a 10; working code with no explanation of the approach is not a 10 either. "
    "Give `score` as an integer from 1 (poor) to 10 (excellent). "
    "Be specific: reference details from the transcript, code, and test results."
)


def _format_test_results(test_results: SubmissionResult) -> str:
    lines = [
        f"{'PASS' if t.passed else 'FAIL'} ({t.status}): {t.call}" for t in test_results.test_results
    ]
    summary = "All tests passed" if test_results.all_passed else "Some tests failed"
    return f"{summary}\n" + "\n".join(lines)


def score_coding_explanation(
    problem_description: str,
    transcript: str,
    code: str,
    test_results: SubmissionResult,
) -> CodingFeedback:
    response = client.messages.parse(
        model="claude-sonnet-5",
        max_tokens=1024,
        output_config={"effort": "low"},
        output_format=CodingFeedback,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Problem: {problem_description}\n\n"
                    f"Candidate's spoken explanation (transcribed): {transcript}\n\n"
                    f"Candidate's submitted code:\n{code}\n\n"
                    f"Test results:\n{_format_test_results(test_results)}"
                ),
            }
        ],
    )

    if response.parsed_output is None:
        raise ValueError("Claude did not return a parseable CodingFeedback response")

    return response.parsed_output
