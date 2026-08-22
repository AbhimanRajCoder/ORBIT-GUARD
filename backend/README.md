# Orbit Guard Backend

This is the FastAPI backend for the Orbit Guard application.

## Prerequisites

- Python 3.9+
- A `.env` file for environment variables (e.g., Supabase credentials, API keys)

## Project Structure

The codebase is organized under the `app/` directory.

- `app/main.py`: The entry point for the FastAPI application.
- `app/routers/`: Contains the API route definitions.
- `app/services/`: Contains the business logic and database interactions.

## Setup Instructions

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Activate the Virtual Environment (Optional but recommended):**
   ```bash
   source venv/bin/activate
   ```
   *Note: If you don't have dependencies installed, run `pip install -r requirements.txt` (or install fastapi, uvicorn, and other dependencies as needed).*

3. **Set up Environment Variables:**
   Ensure you have a `.env` file in the `backend/` directory with the required variables.

## Running the Server

To start the server, you need to run `uvicorn` and point it to the FastAPI app instance located in `app.main`. **Do not** run `uvicorn main:app`, as the `main.py` file is inside the `app/` folder.

Run the following command from the `backend/` directory:

```bash
uvicorn app.main:app --reload
```

- `--reload`: Enables hot reloading for development, so the server restarts when you change code.
- `app.main:app`: Tells Uvicorn to look inside the `app` folder, find `main.py`, and use the `app` object.

The server will start on `http://127.0.0.1:8000`. You can view the automatic interactive API documentation at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Database Initialization
If you need to initialize Supabase, run the initialization script:
```bash
python init_supabase.py
```
