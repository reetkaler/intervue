# Each problem is graded by combining `harness` + the user's submitted code
# + `print(<test case call>)`, sent to Judge0 with `expected_output` — Judge0
# does the exact stdout comparison itself and returns a pass/fail status.

CODING_PROBLEMS = [
    {
        "id": 1,
        "title": "Two Sum",
        "description": (
            "Given a list of integers `nums` and an integer `target`, return the "
            "indices of the two numbers that add up to `target`. Assume exactly "
            "one solution exists."
        ),
        "harness": "",
        "starter_code": (
            "def two_sum(nums, target):\n"
            "    pass\n"
        ),
        "test_cases": [
            {"call": "two_sum([2, 7, 11, 15], 9)", "expected_output": "[0, 1]"},
            {"call": "two_sum([3, 2, 4], 6)", "expected_output": "[1, 2]"},
            {"call": "two_sum([3, 3], 6)", "expected_output": "[0, 1]"},
        ],
    },
    {
        "id": 2,
        "title": "Valid Parentheses",
        "description": (
            "Given a string `s` containing just the characters "
            "'(', ')', '{', '}', '[', ']', return True if the brackets are "
            "balanced and correctly nested, False otherwise."
        ),
        "harness": "",
        "starter_code": (
            "def is_valid(s):\n"
            "    pass\n"
        ),
        "test_cases": [
            {"call": "is_valid('()')", "expected_output": "True"},
            {"call": "is_valid('()[]{}')", "expected_output": "True"},
            {"call": "is_valid('(]')", "expected_output": "False"},
            {"call": "is_valid('([)]')", "expected_output": "False"},
            {"call": "is_valid('{[]}')", "expected_output": "True"},
        ],
    },
    {
        "id": 3,
        "title": "Reverse Linked List",
        "description": (
            "Given the head of a singly linked list, reverse the list and "
            "return the new head."
        ),
        "harness": (
            "class ListNode:\n"
            "    def __init__(self, val=0, next=None):\n"
            "        self.val = val\n"
            "        self.next = next\n"
            "\n"
            "def build_linked_list(values):\n"
            "    head = None\n"
            "    for v in reversed(values):\n"
            "        head = ListNode(v, head)\n"
            "    return head\n"
            "\n"
            "def linked_list_to_list(node):\n"
            "    result = []\n"
            "    while node:\n"
            "        result.append(node.val)\n"
            "        node = node.next\n"
            "    return result\n"
        ),
        "starter_code": (
            "def reverse_list(head):\n"
            "    pass\n"
        ),
        "test_cases": [
            {
                "call": "linked_list_to_list(reverse_list(build_linked_list([1, 2, 3, 4, 5])))",
                "expected_output": "[5, 4, 3, 2, 1]",
            },
            {
                "call": "linked_list_to_list(reverse_list(build_linked_list([1, 2])))",
                "expected_output": "[2, 1]",
            },
            {
                "call": "linked_list_to_list(reverse_list(build_linked_list([])))",
                "expected_output": "[]",
            },
        ],
    },
    {
        "id": 4,
        "title": "Binary Search",
        "description": (
            "Given a list of integers `nums` sorted in ascending order and an "
            "integer `target`, return the index of `target`, or -1 if it's not "
            "present."
        ),
        "harness": "",
        "starter_code": (
            "def binary_search(nums, target):\n"
            "    pass\n"
        ),
        "test_cases": [
            {"call": "binary_search([-1, 0, 3, 5, 9, 12], 9)", "expected_output": "4"},
            {"call": "binary_search([-1, 0, 3, 5, 9, 12], 2)", "expected_output": "-1"},
            {"call": "binary_search([5], 5)", "expected_output": "0"},
        ],
    },
    {
        "id": 5,
        "title": "FizzBuzz",
        "description": (
            "Given an integer `n`, return a list of strings for 1 through n "
            "where each entry is 'Fizz' if divisible by 3, 'Buzz' if divisible "
            "by 5, 'FizzBuzz' if divisible by both, or the number itself as a "
            "string otherwise."
        ),
        "harness": "",
        "starter_code": (
            "def fizzbuzz(n):\n"
            "    pass\n"
        ),
        "test_cases": [
            {
                "call": "fizzbuzz(5)",
                "expected_output": "['1', '2', 'Fizz', '4', 'Buzz']",
            },
            {
                "call": "fizzbuzz(15)",
                "expected_output": (
                    "['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', "
                    "'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz']"
                ),
            },
        ],
    },
]
