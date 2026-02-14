from ..config import settings
from google import genai
from google.genai import types
import os
from typing import List, Dict, Optional


class GeminiClient:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.system_instruction = """
You are a bubbly and lively friend who is outgoing and kind. 
Your goal is to help two (or more) mutual friends meet for the first time by introducing them and highlighting their shared interests.
You should act as a supportive bridge between them.
If the conversation gets dry, you should automatically pick that up and offer engaging, conversation-continuing questions.
Always maintain your friendly, enthusiastic, and welcoming personality.
"""

    def generate_initial_introduction(self, users: List[Dict]) -> str:
        """
        Generates an initial summary and introduction for mutuals.
        Expected user dict format: {"name": str, "interests": list[str], "occupation": str}
        """
        users_info = []
        for u in users:
            interests = ", ".join(u.get("interests", []))
            info = f"Name: {u.get('name')}, Occupation: {u.get('occupation')}, Interests: {interests}"
            users_info.append(info)
        
        prompt = "Please introduce these mutual friends to each other and highlight what they have in common: \n\n" + "\n".join(users_info)
        
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction=self.system_instruction,
            ),
            contents=prompt
        )
        return response.text

    def get_chat_continuation(self, messages: List[Dict]) -> Optional[str]:
        """
        Analyzes the conversation history. If it feels dry or stalled, 
        provides a bubbly intervention with questions to keep it going.
        Expected message format: {"role": "user"|"model", "content": str, "name": str}
        """
        chat_history = "\n".join([f"{m.get('name', m['role'])}: {m['content']}" for m in messages])
        
        prompt = f"""
        Here is the recent conversation history:
        {chat_history}
        
        Analyze if the conversation is getting dry or needs a boost. 
        If it does, provide a lively and bubbly response to keep the conversation going with a question.
        If the conversation is already flowing well, return precisely the word "FLOWING".
        """
        
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction=self.system_instruction,
            ),
            contents=prompt
        )
        
        text = response.text.strip()
        if "FLOWING" in text.upper() and len(text) < 10:
            return None
        return text

    def generate_new_questions(self, messages: List[Dict]) -> str:
        """
        Poses new questions for the conversation based on the context.
        """
        chat_history = "\n".join([f"{m.get('name', m['role'])}: {m['content']}" for m in messages])
        
        prompt = f"""
        Based on this conversation:
        {chat_history}
        
        Pose a few new, exciting questions to help these friends learn more about each other.
        Maintain your bubbly and kind persona.
        """
        
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction=self.system_instruction,
            ),
            contents=prompt
        )
        return response.text