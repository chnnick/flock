"""Basic connection example.
"""

import redis

cache = redis.Redis(
    host='redis-13261.c281.us-east-1-2.ec2.cloud.redislabs.com',
    port=13261,
    decode_responses=True,
    username="default",
    password="aH1pkm7AiWGz4V7iQQxanIBWdL3fwySF",
)

success = cache.set('foo', 'bar')

result = cache.get('foo')
print(result)
