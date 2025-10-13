import os
import json
from fastapi import FastAPI, HTTPException, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import openai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Initialize FastAPI App ---
app = FastAPI(
    title="AI Code Evaluator POC",
    description="An API to evaluate student code submissions against a prompt using an AI model."
)

# --- Add CORS Middleware ---
# This is crucial for allowing your frontend JavaScript to communicate with this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for simplicity in a POC. For production, restrict this to your frontend's domain.
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)


# --- Configure Azure OpenAI Client ---
# This block is set up for your Azure configuration.
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


# --- Master Prompt Template ---
# This is the detailed set of instructions for the AI model.
MASTER_PROMPT_TEMPLATE = """
You are a highly precise AI assistant specializing in evaluating student code projects.
Your task is to determine which of two submissions is a better match for the original prompt.
Please follow these guidelines carefully.

# Evaluation Guidelines:

There are two scenarios: a "Normal Comparison" and a "Critical Trap".

## 1. Critical Trap Scenario Guideline:
- A "Trap" occurs if one submission was built for the correct prompt, and the other was built for a slightly different "trapped" prompt.
- Your job is to evaluate both submissions ONLY against the `correct_prompt`.
- The submission built for a different, "trapped" prompt is an AUTOMATIC FAILURE.
- **Primary Directive:** The trapped submission should always be rejected, even if the submission for the correct prompt is low-quality, incomplete, or empty. Correctness to the assigned prompt is the only priority.

## 2. Normal Comparison Scenario Guideline:
- This occurs when both students received the same prompt.
- **Your first step is to read the `correct_prompt` and create a checklist of all distinct features and user actions mentioned.**
- Your job is to judge which submission is of higher QUALITY and COMPLETENESS by scoring each item on your checklist.
- For each feature on the checklist, score the implementation quality from 0 to 5. A score of 0 means the feature is missing or completely wrong. A score of 5 means it is perfectly implemented as described.
- The submission with the higher total score is the better one.
- **The `analysis` section in your JSON output MUST contain an object for each feature you identified in your checklist.**

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

# Output Formatting:
- Please provide your final answer using the following JSON structure. Do not add any other text or explanations outside of the JSON block.
- Base your `decision_type` on the guidelines above.
- The `final_decision` should clearly state the winner or the reason for rejection.
- The analysis for each submission must be a list of objects, one for each feature identified in the prompt.

{{
  "decision_type": "Trap Detected | Normal Comparison",
  "final_decision": "Submission A is the correct one. Submission B is rejected as a trap because it implements [incorrect feature] instead of [correct feature]. | Submission A is better.",
  "scores": {{
    "submission_a_total": 0,
    "submission_b_total": 0
  }},
  "analysis": {{
    "submission_a": [
      {{"feature": "Core Processor", "score": 4, "reason": "Element is present, but pulsating effect is missing."}},
      {{"feature": "Synaptic Filter Array", "score": 5, "reason": "Element is present and styled correctly."}},
      {{"feature": "Relevance Threshold slider", "score": 3, "reason": "Slider exists but user action logic is not implemented."}}
    ],
    "submission_b": [
      {{"feature": "Core Processor", "score": 5, "reason": "Element is present and fully implemented."}},
      {{"feature": "Synaptic Filter Array", "score": 0, "reason": "Feature is missing. An incorrect 'Bio-Scan Array' was found instead (trap)."}},
      {{"feature": "Relevance Threshold slider", "score": 0, "reason": "Feature is missing. An incorrect 'Threat Level Threshold' slider was found instead (trap)."}}
    ]
  }}
}}
"""

# --- API Endpoints ---

@app.get("/")
async def root():
    """
    A simple root endpoint to confirm the server is running.
    """
    return {"message": "AI Code Evaluator API is running."}


@app.post("/evaluate-files/")
async def evaluate_files(
    correct_prompt: str = Form(...),
    submission_a_file: UploadFile = File(...),
    submission_b_file: UploadFile = File(...)
):
    """
    Receives a prompt and two uploaded code files, then returns an AI evaluation.
    """
    print("Received file evaluation request...")

    # Read the content of the uploaded files
    try:
        submission_a_content = await submission_a_file.read()
        submission_b_content = await submission_b_file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading uploaded files: {e}")

    # Decode the file content from bytes to string
    submission_a = submission_a_content.decode('utf-8')
    submission_b = submission_b_content.decode('utf-8')

    # Populate the master prompt with the data
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
                {"role": "system", "content": "You are a strict AI code evaluator that only outputs JSON."},
                {"role": "user", "content": full_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        print("Received response from Azure OpenAI API.")

        json_string = response.choices[0].message.content
        evaluation_result = json.loads(json_string)
        return evaluation_result

    except openai.APIError as e:
        print(f"OpenAI API error: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred with the OpenAI API: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON from AI response.")
        raise HTTPException(status_code=500, detail="The AI model returned an invalid JSON format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

