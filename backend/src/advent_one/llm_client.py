import base64
import json
import os

import httpx
import yaml


CANONICAL_SAMPLING = {
    "temperature": 0.3,
    "min_p": 0.15,
    "repeat_penalty": 1.05,
}


def _extract_first_json_object(text: str) -> dict:
    if not isinstance(text, str):
        raise ValueError("Model content is not text.")

    decoder = json.JSONDecoder()
    first = text.find("{")
    while first != -1:
        try:
            parsed, _ = decoder.raw_decode(text[first:])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        first = text.find("{", first + 1)

    raise ValueError(f"No valid JSON object found in response content: {text[:500]}")


def _extract_content(payload: dict) -> str:
    try:
        return payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError(f"Unexpected response shape: {payload}") from e


class VLClient:
    def __init__(self, timeout_seconds: float = 120.0) -> None:
        self.base_url = os.getenv("VL_SERVER_URL", "http://localhost:8001").rstrip("/")
        self.model_id = os.getenv("VL_MODEL_ID", "lfm2.5-vl-extract")
        self.timeout_seconds = timeout_seconds

    async def health(self) -> bool:
        url = f"{self.base_url}/health"
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                response = await client.get(url)
            return response.is_success
        except httpx.HTTPError:
            return False

    async def extract(self, image_bytes: bytes, yaml_schema: str) -> dict:
        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        schema_dict = yaml.safe_load(yaml_schema)
        messages = [
            {
                "role": "system",
                "content": yaml_schema,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Extract per the schema.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{encoded_image}",
                        },
                    },
                ],
            },
        ]

        body = {
            "model": self.model_id,
            "messages": messages,
            "response_format": {
                "type": "json_object",
                "schema": schema_dict,
            },
            **CANONICAL_SAMPLING,
        }

        url = f"{self.base_url}/v1/chat/completions"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(url, json=body)

        if not response.is_success:
            raise RuntimeError(
                f"VL extraction request failed ({response.status_code}): {response.text}"
            )

        payload = response.json()
        content = _extract_content(payload)
        return _extract_first_json_object(content)


class JPClient:
    def __init__(self, timeout_seconds: float = 120.0) -> None:
        self.base_url = os.getenv("JP_SERVER_URL", "http://localhost:8002").rstrip("/")
        self.model_id = os.getenv("JP_MODEL_ID", "lfm2.5-1.2b-jp")
        self.timeout_seconds = timeout_seconds

    async def health(self) -> bool:
        url = f"{self.base_url}/health"
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                response = await client.get(url)
            return response.is_success
        except httpx.HTTPError:
            return False

    async def chat(self, messages: list[dict], force_json: bool = False, max_tokens: int = 2048) -> str:
        body: dict = {
            "model": self.model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            **CANONICAL_SAMPLING,
        }
        if force_json:
            body["response_format"] = {"type": "json_object"}

        url = f"{self.base_url}/v1/chat/completions"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(url, json=body)

        if not response.is_success:
            raise RuntimeError(f"JP chat request failed ({response.status_code}): {response.text}")

        payload = response.json()
        return _extract_content(payload)

    async def chat_json(self, messages: list[dict], max_tokens: int = 2048) -> dict:
        content = await self.chat(messages=messages, force_json=True, max_tokens=max_tokens)
        return _extract_first_json_object(content)
