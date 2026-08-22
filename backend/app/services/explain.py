import os
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Tuple
from app.models import Alert

logger = logging.getLogger("triage.explain_service")

def get_fallback_explanation(alert: Alert) -> str:
    now = datetime.now(timezone.utc)
    time_to_approach = alert.time_of_closest_approach - now
    hours = time_to_approach.total_seconds() / 3600.0
    
    # Check TLE age
    caveat = ""
    if alert.candidate_tle_epoch:
        tle_age = now - alert.candidate_tle_epoch
        if tle_age > timedelta(hours=12):
            # Prepend a caveat noting tracking data may be stale
            caveat = "[CAVEAT: Tracking data is stale (>12 hours old)] "
            
    return (
        f"{caveat}Conjunction warning: Candidate {alert.candidate_name} (NORAD ID: {alert.candidate_id}) "
        f"is predicted to approach within {alert.min_distance_km:.3f} km in {hours:.1f} hours "
        f"(Risk Score: {alert.risk_score}/100, Mission Priority: {alert.mission_priority})."
    )

async def explain_alert(alert: Alert) -> Tuple[str, str]:
    """
    Generates a plain-language explanation for the alert.
    
    Provider Hierarchy:
    1. Gemini API (Primary): Chosen as primary because the user's environment has native access
       to latest Gemini models (e.g. gemini-2.5-flash) and offers excellent instruction following.
    2. Groq API (Fallback): Used as fallback if Gemini key is missing or fails.
    3. Template Fallback: If both fail or are missing keys.
    
    Returns:
        Tuple[str, str]: (explanation_text, source)
    """
    now = datetime.now(timezone.utc)
    
    # 1. Freshness Check / Caveat prepending
    caveat = ""
    if alert.candidate_tle_epoch:
        tle_age = now - alert.candidate_tle_epoch
        if tle_age > timedelta(hours=12):
            caveat = "WARNING: Conjunction calculations are based on stale tracking data (epoch is >12 hours old). "

    # Calculate hours to closest approach relative to now
    time_to_approach = alert.time_of_closest_approach - now
    hours_to_approach = time_to_approach.total_seconds() / 3600.0
    
    # Prompts: Instructing the models to avoid any markdown or bold formatting
    system_instruction = (
        "You are a space safety risk explanation system. State the risk level (e.g., High, Medium, Low), "
        "cite the exact distance (km) and time-to-approach (hours) you were given, and explain in "
        "one or two sentences why this ranks where it does. "
        "CRITICAL FORMATTING INSTRUCTIONS:\n"
        "- Output must be PLAIN PROSE sentences only.\n"
        "- Do NOT use markdown formatting (no asterisks, no double asterisks, no headers, no bold, no lists).\n"
        "- Do NOT write labels like '**Risk Level:**' or 'Distance:'. Write plain English sentences (e.g., 'This is a high risk conjunction...').\n"
        "- Do not speculate or invent numbers not present in the input data."
    )
    
    prompt = (
        f"Alert Structured Data:\n"
        f"- Candidate Name: {alert.candidate_name}\n"
        f"- NORAD ID: {alert.candidate_id}\n"
        f"- Minimum Distance: {alert.min_distance_km} km\n"
        f"- Time to Closest Approach: {hours_to_approach:.2f} hours\n"
        f"- Risk Score: {alert.risk_score}/100\n"
        f"- Mission Priority: {alert.mission_priority}\n"
    )
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    
    explanation_text = None
    source = "template_fallback"
    
    # 1. Try Gemini (Primary)
    if gemini_key and not explanation_text:
        try:
            logger.info("Generating explanation using Gemini API (Primary)...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "generationConfig": {
                    "maxOutputTokens": 150,
                    "temperature": 0.2,
                    # Disable extended thinking to avoid truncating output within maxOutputTokens
                    "thinkingConfig": {
                        "thinkingBudget": 0
                    }
                }
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    result = resp.json()
                    explanation_text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
                    source = "gemini"
                else:
                    logger.warning(f"Gemini API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Gemini API call failed with exception: {e}")

    # 2. Try Groq (Fallback)
    if groq_key and not explanation_text:
        try:
            logger.info("Generating explanation using Groq API (Fallback)...")
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "groq/compound-mini",
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 150,
                "temperature": 0.2
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    result = resp.json()
                    explanation_text = result["choices"][0]["message"]["content"].strip()
                    source = "groq"
                else:
                    logger.warning(f"Groq API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Groq API call failed with exception: {e}")

    # Fallback if both LLM APIs failed or are missing keys
    if not explanation_text:
        logger.warning("No LLM API succeeded. Falling back to template-based explanation.")
        return get_fallback_explanation(alert), "template_fallback"
        
    return caveat + explanation_text, source
