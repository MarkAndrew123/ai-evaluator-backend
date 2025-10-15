import os
import json
from fastapi import FastAPI, HTTPException, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Initialize FastAPI App ---
app = FastAPI(
    title="AI Code Evaluator POC",
    description="An API to evaluate student code submissions against a prompt."
)

# --- Add CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configure Azure OpenAI Client ---
try:
    client = openai.AsyncAzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_KEY"),
        api_version="2024-02-01"
    )
    AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    if not AZURE_DEPLOYMENT_NAME:
        raise ValueError("AZURE_OPENAI_DEPLOYMENT_NAME not found in .env file.")
except Exception as e:
    raise ValueError(f"Azure OpenAI client configuration error: {e}")


# --- Master Prompt Template (UPDATED FOR CONCISE OUTPUT) ---
MASTER_PROMPT_TEMPLATE = """
You are a hyper-critical and precise AI code submission evaluator. Your ONLY job is to perform a forensic, differential analysis to determine if a code submission perfectly matches a given prompt. You must operate with 100% accuracy and provide a very short, direct summary of your findings.

# Primary Directive: FORENSIC ANALYSIS
1.  **Identify the Winner:** Compare `[SUBMISSION_A_CODE]` and `[SUBMISSION_B_CODE]` against the `[CORRECT_PROMPT]`.
2.  **Identify Traps:** A submission is a "trap" if it contains **Extra Features**, **Missing Features**, or an **Altered Subject** not in the correct prompt.
3.  **The Unbreakable Rule:** A submission that is a "trap" can NEVER be the winner. The submission that perfectly matches the `[CORRECT_PROMPT]` is always the winner.

# DATA FOR EVALUATION:

[CORRECT_PROMPT]
{correct_prompt}
[/CORRECT_PROMPT]

[SUBMISSION_A_CODE]
{submission_a}
[/SUBMISSION_A_CODE]

[SUBMISSION_B_CODE]
{submission_b}
[/SUBMISSION_B_CODE]

# REQUIRED JSON OUTPUT FORMAT:
- Your response MUST be a single, valid, and concise JSON object.
- DO NOT include scores, feature lists, or long reasons.
- The `trap_details` field should be a list of simple strings. Each string must clearly state what was wrong with the losing submission in the format: "Implemented [Incorrect Thing] instead of [Correct Thing]."

{{
  "result": {{
    "winner": "A",
    "loser": "B",
    "decision_type": "Trap Detected"
  }},
  "trap_details": [
    "Implemented a 'Bio-Scan Array' instead of a 'Synaptic Filter Array'.",
    "Implemented a 'Threat Level Threshold' slider instead of a 'Relevance Threshold' slider."
  ]
}}
"""

# --- API Endpoints ---
@app.get("/")
async def root():
    return {"message": "AI Code Evaluator API is running."}

@app.post("/evaluate-files/")
async def evaluate_files(
    correct_prompt: str = Form(...),
    submission_a_file: UploadFile = File(...),
    submission_b_file: UploadFile = File(...)
):
    print("Received file evaluation request...")
    try:
        submission_a_content = await submission_a_file.read()
        submission_b_content = await submission_b_file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading uploaded files: {e}")

    submission_a = submission_a_content.decode('utf-8')
    submission_b = submission_b_content.decode('utf-8')

    full_prompt = MASTER_PROMPT_TEMPLATE.format(
        correct_prompt=correct_prompt,
        submission_a=submission_a,
        submission_b=submission_b
    )

    try:
        print("Sending request to Azure OpenAI API...")
        response = await client.chat.completions.create(
            model=AZURE_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a strict AI code evaluator that only outputs a concise JSON summary."},
                {"role": "user", "content": full_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.0
        )
        print("Received response from Azure OpenAI API.")

        json_string = response.choices[0].message.content
        evaluation_result = json.loads(json_string)
        return evaluation_result

    except openai.APIError as e:
        print(f"OpenAI API error: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred with the OpenAI API: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")