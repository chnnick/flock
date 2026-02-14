### GeminiClient Usage

The `GeminiClient` is designed to handle all interactions with the Gemini API, maintaining a bubbly and friendly persona to help connect mutual friends.

#### Initialization

The client automatically retrieves the API key from the application settings.

```python
from api.src.gemini.gemini import GeminiClient

client = GeminiClient() #gets the api key automatically
```

#### Methods

##### 1. Generate Initial Introduction
Generates a warm, enthusiastic introduction for two or more users based on their interests and occupations.

```python
users = [
    {"name": "Alice", "occupation": "Software Engineer", "interests": ["hiking", "coding", "photography"]},
    {"name": "Bob", "occupation": "Graphic Designer", "interests": ["photography", "cooking", "traveling"]}
]

introduction = client.generate_initial_introduction(users)
print(introduction)
```

##### 2. Get Chat Continuation
Analyzes conversation history and provides a bubbly intervention if the conversation feels dry or stalled. Returns `None` if the conversation is flowing well.

```python
messages = [
    {"role": "user", "name": "Alice", "content": "Hi Bob!"},
    {"role": "user", "name": "Bob", "content": "Hey Alice, how are you?"},
    {"role": "user", "name": "Alice", "content": "I am good."}
]

continuation = client.get_chat_continuation(messages)
if continuation:
    print(continuation)
```

##### 3. Generate New Questions
Poses new, exciting questions based on the chat context to help friends learn more about each other.

```python
messages = [
    {"role": "user", "name": "Alice", "content": "I love photography!"},
    {"role": "user", "name": "Bob", "content": "Me too! I usually shoot landscapes."}
]

questions = client.generate_new_questions(messages)
print(questions)
```
