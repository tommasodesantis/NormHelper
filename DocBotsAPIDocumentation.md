Core concepts

Authentication
An overview of how to handle authentication for our various APIs.

Teams and Permissions
What is a team?
A team is the basic root of a DocsBot account. Plans and limits are tied to a team, which has a collection of bots and their sources. Multiple user accounts can be assigned to a team. Each team has a unique ID and a name.

Key permissions
API keys are unique to each user account and their permissions mirror that of your user account. For example, if your user account has access to multiple teams, your API key will also have access to all of those teams.

API authentication
Getting your API key
To use our APIs, you need to get an API key. You can get your API key from the API Keys section of your dashboard. This is the key associated with your user account and will be the same no matter which team dashboard you are in. You can create or change your API key at any time by clicking the "Change" button. When you change your key, all previous API requests will stop working until you configure them to use the new key.

Don't forget to copy!

API keys are only shown once as we store them safely hashed, so make sure you copy it to a safe place. If you lose or forget your key you will have to create a new one.

Authenticating requests
REST API endpoints
DocsBot for all its REST APIs uses the standard Authorization header to authenticate requests with a Bearer token. You can authenticate requests by including your API key in the Authorization header prefixed with the "Bearer" keyword. For example, if your API key is 1234567890, you would include the following header in your request:

Authorization: Bearer 1234567890
Websocket API endpoints (Streaming)
For the streaming APIs, websockets do not support Authorization headers. You should send the API key as an auth parameter with the questions. For example:

// Send message to server when connection is established
ws.onopen = function (event) {
  const req = { question: 'What is WordPress?', full_source: false, history: [], auth: '1234567890' }
  ws.send(JSON.stringify(req))
}
Do not expose your API key!

API keys are meant to be used server-side, and should never be exposed to the public in JavaScript. If you are using a client-side library, make sure you are not exposing your API key to the public by proxying requests through your own server.

Examples
Here are some examples of how to authenticate a request with the GET /api/teams/ Admin API endpoint:

cURL
curl --request GET 'https://docsbot.ai/api/teams/' \
--header 'Authorization: Bearer 2e9fd6965890e80b9a7bb271900ab859e199a5778f851b73d97136d3495849ef'
JavaScript Fetch
var myHeaders = new Headers();
myHeaders.append("Authorization", "Bearer 2e9fd6965890e80b9a7bb271900ab859e199a5778f851b73d97136d3495849ef");

var requestOptions = {
  method: 'GET',
  headers: myHeaders,
  redirect: 'follow'
};

fetch("https://docsbot.ai/api/teams/", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));
PHP cURL
<?php

$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => 'https://docsbot.ai/api/teams/',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 1,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'GET',
  CURLOPT_HTTPHEADER => array(
    'Authorization: Bearer 2e9fd6965890e80b9a7bb271900ab859e199a5778f851b73d97136d3495849ef'
  ),
));

$response = curl_exec($curl);

curl_close($curl);
echo $response;
Python
import requests

url = "https://docsbot.ai/api/teams/"

payload={}
headers = {
  'Authorization': 'Bearer 2e9fd6965890e80b9a7bb271900ab859e199a5778f851b73d97136d3495849ef'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)

Core concepts

API Errors
Learn about the errors you might encounter when using our APIs.

Introduction
When you use our APIs, you might encounter errors. This page describes the errors you might encounter and how to handle them.

Error codes
We use standard HTTP status codes to indicate the success or failure of an API request. In general: Codes in the 2xx range indicate success. Codes in the 4xx range indicate an error that failed given the information provided (e.g., a required parameter was omitted, a charge failed, etc.). Codes in the 5xx range indicate an error with our servers (these are rare).

Example error response
HTTP 400 Bad Request

{
    "message": "Invalid param \"privacy\"."
}

Chat APIs Overview
Use the chat API endpoints to create your own Q/A and chat interfaces in your product.

Introduction
There is one chat API endpoint that can be used for different purposes:

Question and Answer (Q/A) Bots
Q/A bots are the simplest and is used to get answers to questions. You pass it one question, and it returns one answer along with its sources. It lets you create a simple Q/A interface in your product. This uses the same endpoint as the chat API, you simply don't pass any chat history.

Chat Bots
The chat API is more complex and is used to create a full chat interface in your product. You pass it a question plus chat history, and it returns the next answer along with its sources. It also returns the new chat history array to pass back with the next response. This is the endpoint you should use if you want to create a full chat interface in your product.

Chat Agent API (NEW)

The Chat Agent API is our latest and most powerful API for integrating conversational chatbots with your product. You input a question and receive the answer along with its sources. This API can employ multiple agent tools to address queries and perform actions, and even accept images for multimodal chats when using supported models. For output it supports both non-streaming and streaming responses using SSE (similar to the OpenAI API).

The original Chat API is stateless, meaning we don't track chat sessions between requests via a cookie or any other method. It's the responsibility of your code to do any session tracking by saving the returned chat history to send with the next request. This makes it a bit more complex to implement, but it also makes it more flexible and allows you to use the API in any way you want.

Read more about the Chat API

REST vs Websocket Streaming APIs
There are two ways to use the older chat APIs: REST and streaming via websocket. The REST API is the simplest as its just a simple HTTP request and response. The streaming API is more complex as it requires a websocket connection to be established and maintained. The streaming API is more efficient as it allows you to receive responses as soon as they are available, rather than waiting for the entire response to be generated. It also allows you to display the answers as they are being generated, rather than waiting for the entire response to be generated then returned. This makes for a much more interactive experience for the user.

Chat API
The chat API is used to create a Question/Answer and chat bots in your product. You pass it a question plus optional chat history, and it returns the next answer along with its sources. It also returns the new chat history array to pass back with the next response. This is the endpoint you should use if you want to create any Q/A or chat interface in your product.

Request
This endpoint accepts a POST request with the following parameters:

POST https://api.docsbot.ai/teams/[teamId]/bots/[botId]/chat

Parameters
Parameter	Type	Description
question	string	The question to ask the bot. 2 to 2000 characters. Max is model context length when authenticated.
full_source	boolean	Whether the full source content should be returned. Optional, defaults to false
format	string	How to format the answer. Can be markdown or text. Optional, defaults to markdown
history	array	The chat history array. Optional, defaults to []
metadata	object	A user identification object with arbitrary metadata about the the user. Will be saved to the question history log. Keys referrer, email, and name are shown in question history logs. Optional, defaults to null
testing	boolean	Whether to mark question logs as by staff. Optional, defaults to false
context_items	integer	Number of sources to lookup for the bot to answer from. Optional, default is 5. Research mode uses 16 (more expensive token usage).
autocut	integer/false	Autocut results to num groups. Optional, defaults to false
full_source behavior

If full_source is set to true, the content property of each source will be populated with the full source content. This can be useful if you want to display the full source content in your interface. As source pages are divided into chunks, we normally only return unique source title/urls. But if this parameter is set to true multiple sources may be returned with the same title/url but different content.

autocut behavior

Autocut introduces a maximum result counts. This method organizes results into groups based on significant distance jumps, offering a more intuitive way to segregate relevant from irrelevant data. Autocut addresses the reduction of irrelevant information fed into generative searches. Research by highlights the negative impact of irrelevant content on large language models, underscoring the importance of precision in search results. Autocut's design is rooted in the concept of intuitively "cutting" search results at natural breaks, improving AI-driven search efficiencies. When enabled, autocut will return the top num groups of results trimmed by the context_items parameter.

Examples
cURL
curl --request POST 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/chat' \
--header 'Content-Type: application/json' \
--data-raw '{
    "question": "What is WordPress?",
    "full_source": false,
    "metadata": {
        "referrer": "https://example.com",
        "email": "john@doe.com",
        "name": "John Doe"
    }
}'
JavaScript (Fetch)
var myHeaders = new Headers()
myHeaders.append('Content-Type', 'application/json')

var raw = JSON.stringify({
  question: 'What is WordPress?',
  full_source: false,
})

var requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: raw,
  redirect: 'follow',
}

fetch(
  'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/chat',
  requestOptions
)
  .then((response) => response.text())
  .then((result) => console.log(result))
  .catch((error) => console.log('error', error))
PHP (cURL)
<?php

$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/chat',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 1,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS =>'{
    "question": "What is WordPress?",
    "full_source": false
}',
  CURLOPT_HTTPHEADER => array(
    'Content-Type: application/json'
  ),
));

$response = curl_exec($curl);

curl_close($curl);
echo $response;
Response
Response is a JSON object with the following properties:

Property	Type	Description
answer	string	The answer to the question in Markdown format.
sources	array	An array of source objects. Each source object contains the source type, title and optionally url, page, or content if full_source was true.
history	array	The new chat history array to pass back with the next response.
id	string	The unique ID of the answer. Use for the rating API.
couldAnswer	boolean/null	Whether the bot could answer the question if classify is enabled for the bot.
The Source object
Source objects found in the sources array have the following properties:

Property	Type	Description
type	string	Can be url, document, sitemap, wp, urls, csv, etc.
title	string	The source title.
url	string/null	The url for the source as set during indexing. May be null.
page	string/null	The page for the source as set during indexing. May be null.
content	string/null	The full source tex content for the source as set during indexing if full_source was true. May be null.
used	boolean	Whether the source was used to answer the question if classify was enabled.
Classify behavior

If classify answers is enabled for the bot and full_source is set to false (default), then only the used sources will be returned if couldAnswer is true. Otherwise, all sources will be returned.

{
  "answer": "WordPress is an open source free software distributed under the GPL license. It is a self-hosted content management system that enables users to create and manage websites.",
  "sources": [
    {
      "type": "urls",
      "title": "Introduction to Open-Source | Learn WordPress ",
      "url": "https://learn.wordpress.org/tutorial/introduction-to-open-source/",
      "page": null,
      "content": null
    },
    {
      "type": "urls",
      "title": "WordPress.org and WordPress.com – WordPress.org Documentation",
      "url": "https://wordpress.org/documentation/article/wordpress-org-and-wordpress-com/",
      "page": null,
      "content": null
    },
    {
      "type": "urls",
      "title": "What is Open Source? | Learn WordPress ",
      "url": "https://learn.wordpress.org/lesson-plan/what-is-open-source/",
      "page": null,
      "content": null
    },
    {
      "type": "urls",
      "title": "High-Level Overview | Learn WordPress ",
      "url": "https://learn.wordpress.org/lesson-plan/high-level-overview/",
      "page": null,
      "content": null
    }
  ],
  "history": [
    [
      "What is WordPress?",
      "WordPress is an open source free software distributed under the GPL license. It is a self-hosted content management system that enables users to create and manage websites."
    ]
  ],
  "id": "O0avZ8ffTiAMRyjNrZpU"
}
Follow-up questions
If you want to create a true chat experience, you can send follow-up questions to the API so that it remembers what was discussed previously in the conversation.

The Chat API is stateless, meaning we don't track chat sessions between requests via a cookie or any other method. It's the responsibility of your code to do any session tracking by saving the returned chat history parameter to send with the next request. This makes it a bit more complex to implement, but it also makes it more flexible and allows you to use the API in any way you want.

Given the reponse above, you can send a follow-up question that includes the returned history like this:

curl --request POST 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/chat' \
--header 'Content-Type: application/json' \
--data-raw '{
    "question": "Who created it?",
    "full_source": false,
    "history": [
        [
            "What is WordPress?",
            "WordPress is an open source free software distributed under the GPL license. It is a self-hosted content management system that enables users to create and manage websites."
        ]
    ],
    "metadata": {
        "referrer": "https://example.com",
        "email": "john@doe.com",
        "name": "John Doe"
    }
}'
Now the response obviously understood the context of the conversation from the provided history:

{
  "answer": "WordPress was created by Matt Mullenweg and Mike Little in 2003.",
  "sources": [
    {
      "type": "urls",
      "title": "Introduction to Contributing to WordPress | Learn WordPress ",
      "url": "https://learn.wordpress.org/tutorial/an-introduction-to-contributing/",
      "page": null,
      "content": null
    },
    {
      "type": "urls",
      "title": "General History Of WordPress | Learn WordPress ",
      "url": "https://learn.wordpress.org/lesson-plan/general-history-of-wordpress/",
      "page": null,
      "content": null
    },
    {
      "type": "urls",
      "title": "Learn about WordPress origins and version history – WordPress.org Documentation",
      "url": "https://wordpress.org/documentation/article/learn-about-wordpress-and-version-history/",
      "page": null,
      "content": null
    },
    {
      "type": "urls",
      "title": "Introduction to Open-Source | Learn WordPress ",
      "url": "https://learn.wordpress.org/tutorial/introduction-to-open-source/",
      "page": null,
      "content": null
    }
  ],
  "history": [
    [
      "What is WordPress?",
      "WordPress is an open source free software distributed under the GPL license. It is a self-hosted content management system that enables users to create and manage websites."
    ],
    ["Who created it?", "WordPress was created by Matt Mullenweg and Mike Little in 2003."]
  ],
  "id": "FFssbdOYB9VcEroEKM59"
}

Streaming Chat API
The chat API is used to create a full chat interface in your product. You pass it a question plus chat history, and it returns the next answer along with its sources. It also returns the new chat history array to pass back with the next response. This is the endpoint you should use if you want to create a full chat interface in your product.

Streaming Q/A Ask

You can also use this API for simpler Q/A bots, just omit the history parameter. This will return a single answer and source. This is the endpoint you should use if you want to create a simple Q/A interface in your product where you can stream the reply back to the user as soon as it is available.

Request
This endpoint accepts a websocket request with the following parameters in the initial message on the open socket:

wss://api.docsbot.ai/teams/[teamId]/bots/[botId]/chat

Parameters
Parameter	Type	Description
question	string	The question to ask the bot. 2 to 2000 characters. Max is model context length when authenticated.
full_source	boolean	Whether the full source content should be returned. Optional, defaults to false
format	string	How to format the answer. Can be markdown or text. Optional, defaults to markdown
history	array	The chat history array. Optional, defaults to []
auth	string	The API key. Required only for private bots.
metadata	object	A user identification object with arbitrary metadata about the the user. Will be saved to the question history log. Keys referrer, email, and name are shown in question history logs. Optional, defaults to null
testing	boolean	Whether to mark question logs as by staff. Optional, defaults to false
context_items	integer	Number of sources to lookup for the bot to answer from. Optional, default is 5. Research mode uses 16 (more expensive token usage).
autocut	integer/false	Autocut results to num groups. Optional, defaults to false
full_source behavior

If full_source is set to true, the content property of each source will be populated with the full source content. This can be useful if you want to display the full source content in your interface. As source pages are divided into chunks, we normally only return unique source title/urls. But if this parameter is set to true multiple sources may be returned with the same title/url but different content.

autocut behavior

Autocut introduces a maximum result counts. This method organizes results into groups based on significant distance jumps, offering a more intuitive way to segregate relevant from irrelevant data. Autocut addresses the reduction of irrelevant information fed into generative searches. Research by highlights the negative impact of irrelevant content on large language models, underscoring the importance of precision in search results. Autocut's design is rooted in the concept of intuitively "cutting" search results at natural breaks, improving AI-driven search efficiencies. When enabled, autocut will return the top num groups of results trimmed by the context_items parameter.

Do not expose your API key!

API keys are meant to be used server-side, and should never be exposed to the public in JavaScript. If you are using a client-side library, make sure you are not exposing your API key to the public by proxying requests through your own server.

Responses
Messages
WebSocket messages are received as a JSON string formatted like this:

{
  "sender": "bot",
  "message": "",
  "type": "start"
}
They can be of type start, stream, info, or end. The message property is the actual message. The sender property is either bot or user. The start and end types are only sent once. The stream type is sent many times. The info type is not generally used.

The end message type
The end type is the last message before the API closes the websocket (except for errors). It contains the answer and sources and is formatted like this:

{
  "sender": "bot",
  "message": "{\"answer\":\"WordPress is an open source free software distributed under the GPL license. It is a self-hosted content management system that enables users to create and manage websites.\",\"sources\":[{\"type\":\"urls\",\"title\":\"Introduction to Open-Source | Learn WordPress\",\"url\":\"https://learn.wordpress.org/tutorial/introduction-to-open-source/\",\"page\":null,\"content\":null},{\"type\":\"urls\",\"title\":\"WordPress.org and WordPress.com \u2013 WordPress.org Documentation\",\"url\":\"https://wordpress.org/documentation/article/wordpress-org-and-wordpress-com/\",\"page\":null,\"content\":null},{\"type\":\"urls\",\"title\":\"What is Open Source? | Learn WordPress \",\"url\":\"https://learn.wordpress.org/lesson-plan/what-is-open-source/\",\"page\":null,\"content\":null},{\"type\":\"urls\",\"title\":\"High-Level Overview | Learn WordPress \",\"url\":\"https://learn.wordpress.org/lesson-plan/high-level-overview/\",\"page\":null,\"content\":null}],\"id\":\"O0avZ8ffTiAMRyjNrZpU\",\"history\":[]}",
  "type": "end"
}
When the message property JSON is parsed, the result is an object like:

{
  "answer": "WordPress is an open source free software distributed under the GPL license. It is a self-hosted content management system that enables users to create and manage websites.",
  "sources": [
    {
      "type": "urls",
      "title": "Introduction to Open-Source | Learn WordPress",
      "url": "https://learn.wordpress.org/tutorial/introduction-to-open-source/",
      "page": null,
      "content": null,
      "used": false
    },
    {
      "type": "urls",
      "title": "WordPress.org and WordPress.com – WordPress.org Documentation",
      "url": "https://wordpress.org/documentation/article/wordpress-org-and-wordpress-com/",
      "page": null,
      "content": null,
      "used": true
    },
    {
      "type": "urls",
      "title": "What is Open Source? | Learn WordPress ",
      "url": "https://learn.wordpress.org/lesson-plan/what-is-open-source/",
      "page": null,
      "content": null,
      "used": false
    },
    {
      "type": "urls",
      "title": "High-Level Overview | Learn WordPress ",
      "url": "https://learn.wordpress.org/lesson-plan/high-level-overview/",
      "page": null,
      "content": null,
      "used": true
    }
  ],
  "id": "O0avZ8ffTiAMRyjNrZpU",
  "history": [],
  "couldAnswer": true
}
The message is a JSON string with the following properties:

Property	Type	Description
answer	string	The answer to the question in Markdown format.
sources	array	An array of source objects. Each source object contains the source type, title and optionally url, page, or content if full_source was true.
id	string	The unique ID of the answer. Use for the rating API.
history	array	The chat history array. Save this and send it with the next question to continue the conversation.
couldAnswer	boolean/null	Whether the bot could answer the question if classify is enabled for the bot.
Example
Open a websocket connection
const apiUrl = `wss://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/chat`
const ws = new WebSocket(apiUrl)
Send the question as the first message
// Send message to server when connection is established
ws.onopen = function (event) {
  const question = 'What is WordPress?'
  const req = { question: question, full_source: false, history: [] }
  ws.send(JSON.stringify(req))
}
Handle the response messages
// Receive message from server word by word. Display the words as they are received.
ws.onmessage = function (event) {
  const data = JSON.parse(event.data)
  if (data.sender === 'bot') {
    if (data.type === 'start') {
      //start a new answer, streaming will follow
      //start response looks like this JSON:
      /*
        {
            sender="bot",
            message="",
            type="start"
        }
        */
    } else if (data.type === 'stream') {
      //this is a streaming response word by word, it will be sent many times. Update the UI by appending these messages to the current answer.
      //stream response looks like this JSON:
      /*
        {
            sender="bot",
            message="Word1",
            type="stream"
        }
        */
    } else if (data.type === 'info') {
      //info response not generally used, looks like this JSON:
      /*
        {
            sender="bot",
            message="Synthesizing question...",
            type="info"
        }
        */
    } else if (data.type === 'end') {
      //this is the final response containing all data, it will be sent once after streaming completes. Update the UI with the final answer and sources.

      //parse the message property which is a JSON string
      const endData = JSON.parse(data.message)
      const history = endData.history //this is the new chat history array to pass back with the next question
      const finalAnswer = endData.answer // this is the final full answer in Markdown format
      const sources = endData.sources //this is an array of source objects
      const id = endData.id //this is the unique ID of the answer. Use for the rating API.

      ws.close()
    } else if (data.type === 'error') {
      alert(data.message)
      //error response looks like this JSON:
      /*
        {
            sender="bot",
            message="Please enter a question between 10 and 200 characters.",
            type="error"
        }
        */
      ws.close()
    }
  }
}
Handle errors
ws.onerror = function (event) {
  console.warn(event)
  alert('There was a connection error. Please try again.')
}

//The API will close the connection when it is done sending the response. If the connection closes before the API is done, it was an error.
ws.onclose = function (event) {
  if (!event.wasClean) {
    console.warn(event)
    alert('Network error, please try again.')
  }
}

Chat Agent API (BETA)
The chat Agent API is our latest and most powerful API for integrating conversational chatbots with your product. You input a question and receive the answer along with its sources. This API can employ multiple agent tools to address queries and perform actions, and even accept images for multimodal chats when using supported models. For output it supports both non-streaming and streaming responses using SSE (similar to the OpenAI API).

Stateful API

Unlike our older chat APIs, this API is stateful, meaning it maintains the conversation context and history between requests. This allows for more sophisticated interactions and better responses, and frees you from having to store and send the conversation history with each request. This is done by you generating a UUID for each conversation and sending it with each request as the conversationId parameter. Any time you change the UUID it will create a new conversation thread in our database. To save on token usage costs and improve performance, we recommend making it simple for the user to start a new conversation thread when they change the subject, such as by clicking a button or resetting after a certain time period. For example our widget will reset the conversation after 12 hours of inactivity.

Request
This endpoint accepts a POST request with the following parameters: POST https://api.docsbot.ai/teams/[teamId]/bots/[botId]/chat-agent

Replace [teamId] and [botId] with your actual team and bot identifiers.

Parameters
Parameter	Type	Description
stream	boolean	Whether to stream responses back to the client using SSE. Optional, defaults to false.
conversationId	string	The conversation ID to maintain the chat. This should be a UUID that you generate on your side and change to start a new conversation.
question	string	The question to ask the bot. 2 to 2000 characters. Max is model context length when authenticated.
metadata	object	A user identification object with arbitrary metadata about the user. Will be saved to the question and conversation. Keys referrer, email, and name are shown in question history logs. Optional, defaults to null.
context_items	integer	Number of sources to lookup for the bot to answer from. Optional, default is 5. Research mode uses 16 (more expensive token usage).
human_escalation	boolean	Whether to enable the human escalation classifier tool. Optional, defaults to false.
followup_rating	boolean	Whether to include follow-up rating questions tool. Optional, defaults to false.
document_retriever	boolean	Whether to retrieve documents for the bot to answer from. Optional, defaults to true.
full_source	boolean	Whether the full source content should be returned. Optional, defaults to false.
autocut	integer/boolean	Autocut results to num groups. Optional, defaults to false.
testing	boolean	Whether the request is for testing purposes. Optional, defaults to false.
image_urls	array	List of image URLs to include with the question as context. Optional, defaults to null.
Vision

Newer AI models like GPT-4o and GPT-4 Turbo support multimodal inputs, which means they can process both text and images. If the bot is using one of these models, you can include image URLs in your request via the image_urls parameter to provide additional context for the AI. The AI will use both the text and images to generate a response. If you're using a model that doesn't support images, the API will return an error if you include via the image_urls in your request. For details on using vision and its limitations, see the OpenAI Docs.

Example Request
{
  "conversationId": "1234567",
  "question": "What is docsbot pricing.",
  "metadata": { "name": "your_name", "email": "your@gmail.com" },
  "context_items": 5,
  "human_escalation": false,
  "followup_rating": false,
  "document_retriever": true,
  "full_source": false,
  "stream": false,
  "auto_cut": false,
  "image_urls": ["http://example.com/image1.jpg", "data:image/jpeg;base64,XXXXXXXX"]
}
Response
When stream is False (default), the response is an array of JSON objects with the following properties:

Property	Type	Description
event	string	Type of event indicating which type of tool is run.
data	dict	Information about answer
When stream is True, the response is a SSE stream of events, each containing the same properties as above mapped to the proper SSE fields event and data. In this case data is a JSON string that must be parsed. It is recommended to use a package like Better SSE to handle SSE streams in the browser. See this response example for more details.

The data object
Data objects found in the data could have the following properties depending on the event type:

Field	Type	Description
answer	string	The answer to the query or question.
history	array	An array containing the history of interactions related to the query, including user inputs and AI responses. Always included.
sources	array	An array of sources used to generate the answer. Only for lookup_answer.
id	string	Unique identifier for the query or response used for rating. Not present for is_resolved_question.
couldAnswer	boolean	Indicates whether an answer could be generated for the query or not. Only for lookup_answer.
options	object	Preset options for the user to respond to the answer. Only for is_resolved_question or support_escalation event types. While optional, these can be displayed as clickable presets in the chat UI.
The source object
Source objects found in the sources array (if present) have the following properties:

Property	Type	Description
type	string	Can be url, document, sitemap, wp, urls, csv, etc.
title	string	The source title.
url	string	The url for the source as set during indexing. May be null.
page	string	The page for the source as set during indexing. May be null.
content	string	The full source tex content for the source as set during indexing if full_source was true. May be null.
used	boolean	Whether the source was used to answer the question if classify was enabled.
Example Non-Streaming Response
[
    {
        "event": "lookup_answer",
        "data": {
            "answer": "DocsBot offers different pricing plans to fit various needs:\n\n1. **Hobby Plan** - $16/month ($192 annually)\n   - 1 DocsBot\n   - 1k Source Pages\n   - 1k questions/mo\n   - Private bot\n   - GPT-4o support\n   - 1 user\n\n2. **Power Plan** - $41/month ($492 annually)\n   - 3 DocsBots\n   - 5k Source Pages\n   - 5k questions/mo\n   - Monthly source refresh\n   - Private bots\n   - GPT-4o support\n   - 1 user\n   - Basic Analytics\n   - Zapier integration\n   - Chat history\n\n3. **Pro Plan** - $83/month ($996 annually)\n   - 10 DocsBots\n   - 10k Source Pages\n   - 10k questions/mo\n   - Weekly source refresh\n   - Private bots\n   - GPT-4o support\n   - 5 team users\n   - Advanced Analytics\n   - Zapier integration\n   - Chat history\n   - Unbranded chat widgets\n   - Prompt customization\n\nFor more advanced plans like Business and Enterprise, you can [contact DocsBot](mailto:human@docsbot.ai) for customized pricing and features.",
            "history": [
                {
                    "Human": "what is docsbot pricing.",
                    "timestamp": "2024-05-28T16:22:01.451418"
                },
                {
                    "AI": "DocsBot offers different pricing plans to fit various needs:\n\n1. **Hobby Plan** - $16/month ($192 annually)\n   - 1 DocsBot\n   - 1k Source Pages\n   - 1k questions/mo\n   - Private bot\n   - GPT-4o support\n   - 1 user\n\n2. **Power Plan** - $41/month ($492 annually)\n   - 3 DocsBots\n   - 5k Source Pages\n   - 5k questions/mo\n   - Monthly source refresh\n   - Private bots\n   - GPT-4o support\n   - 1 user\n   - Basic Analytics\n   - Zapier integration\n   - Chat history\n\n3. **Pro Plan** - $83/month ($996 annually)\n   - 10 DocsBots\n   - 10k Source Pages\n   - 10k questions/mo\n   - Weekly source refresh\n   - Private bots\n   - GPT-4o support\n   - 5 team users\n   - Advanced Analytics\n   - Zapier integration\n   - Chat history\n   - Unbranded chat widgets\n   - Prompt customization\n\nFor more advanced plans like Business and Enterprise, you can [contact DocsBot](mailto:human@docsbot.ai) for customized pricing and features.",
                    "timestamp": "2024-05-28T16:22:22.343897",
                    "type": "lookup_answer"
                }
            ],
            "sources": [
                {
                    "page": null,
                    "title": "DocsBot AI - Custom chatbots from your documentation",
                    "type": "url",
                    "url": "https://docsbot.ai/",
                    "used": false,
                    "content": "## ChatGPT-powered customer support\n\nTrain and deploy custom chatbots in minutes!\n\nAre you tired of answering the same questions over and over again? Do you wish you had a way to automate your customer support and give your team more time to focus on other tasks? With DocsBot, you can do just that. We make it simple to build ChatGPT-powered bots that are trained with your content and documentation, so they can provide instant answers to your customers' most detailed questions.
                },
                {
                    "page": null,
                    "title": "DocsBot AI - Custom chatbots from your documentation",
                    "type": "url",
                    "url": "https://docsbot.ai/",
                    "used": false,
                    "content": "### Business\n\nFor serious traffic, priority support, and AI reports to improve your docs.\n\n$416/month\n\n($4992/annually)\n\n[Get started](https://docsbot.ai/register)* 100 DocsBots\n* 100k Source Pages\n* Unlock all source types\n* Weekly source refresh\n* 100k questions/mo\n* Private bots\n* GPT-4o support\n* 15 team users\n* Advanced Analytics\n* Zapier integration\n* Chat history\n* Unbranded chat widgets\n* AI question reports\n* Prompt customization\n* Priority support\n* Rate limiting\nDoes not include OpenAI API costs (<$0.0002/question)\n\n\n### Personal\n\nTry DocsBot free for personal use. No credit card required. Import document files or urls with up to 50 pages of content and start chatting with your bot.
                },
            ],
            "id": "yhqSGaKpM6ebkxp6KtDc",
            "couldAnswer": true
        }
    },
    {
        "event": "is_resolved_question",
        "data": {
            "answer": "Was that helpful?",
            "history": [
                {
                    "Human": "what is docsbot pricing.",
                    "timestamp": "2024-05-28T16:22:01.451418"
                },
                {
                    "AI": "DocsBot offers different pricing plans to fit various needs:\n\n1. **Hobby Plan** - $16/month ($192 annually)\n   - 1 DocsBot\n   - 1k Source Pages\n   - 1k questions/mo\n   - Private bot\n   - GPT-4o support\n   - 1 user\n\n2. **Power Plan** - $41/month ($492 annually)\n   - 3 DocsBots\n   - 5k Source Pages\n   - 5k questions/mo\n   - Monthly source refresh\n   - Private bots\n   - GPT-4o support\n   - 1 user\n   - Basic Analytics\n   - Zapier integration\n   - Chat history\n\n3. **Pro Plan** - $83/month ($996 annually)\n   - 10 DocsBots\n   - 10k Source Pages\n   - 10k questions/mo\n   - Weekly source refresh\n   - Private bots\n   - GPT-4o support\n   - 5 team users\n   - Advanced Analytics\n   - Zapier integration\n   - Chat history\n   - Unbranded chat widgets\n   - Prompt customization\n\nFor more advanced plans like Business and Enterprise, you can [contact DocsBot](mailto:human@docsbot.ai) for customized pricing and features.",
                    "timestamp": "2024-05-28T16:22:22.343897",
                    "type": "lookup_answer"
                },
                {
                    "AI": "Was that helpful?",
                    "timestamp": "2024-05-28T16:22:30.568233",
                    "type": "is_resolved_question",
                    "options": {
                        "yes": "👍 That helped",
                        "no": "No"
                    }
                }
            ],
            "options": {
                "yes": "👍 That helped",
                "no": "No"
            }
        }
    }
]
Event types
answer
When the event type is answer, the agent provides a simple response from the chat history using no tools, such as when a user responds with "Thank you". This will have no sources.

lookup_answer
When the event type is lookup_answer, the retriever tool provides the answer along with sources from your bot's training data. This is the most common event type and is used for general questions and queries, and the response is nearly identical to our older chat APIs. Only used when document_retriever argument is set to true (default).

is_resolved_question
The is_resolved_question event is used after a lookup_answer to collect user feedback using natural language. It asks the user if the answer was helpful and provides options for the user to respond. This is used to improve the AI's performance and provide better answers in the future. Only used when followup_rating argument is set to true.

support_escalation
The support_escalation event is triggered when LLM determines that the user requests human support. It provides options for the user to confirm if they want to escalate to human support. This is used to provide a seamless transition from AI to human support. Only used when human_escalation argument is set to true.

stream
When streaming response is enabled via the stream parameter, the answer is initially sent as a stream of stream events so that you can display the progress to the user as it's generated. Each stream event is a token to be appended to the latest message, which is commonly parsed as markdown for proper formatting. When the answer streaming is complete it will followed by a different event type such as lookup_answer that contains the final full answer to display. See this response example for more details.

Error Handling
The API returns standard HTTP status codes to indicate the success or failure of the request. The following error codes are used:

404 Not Found: Invalid bot ID.
409 Conflict: Bot is not ready for questions.
403 Forbidden: Authentication error or missing API key.
400 Bad Request: Invalid parameters or unsupported features such as images.
413 Request Entity Too Large: Question is too long.
429 Too Many Requests: Rate limiting exceeded or Team question limit exceeded.
500 Internal Server Error: Unexpected errors.

Answer Rating & Escalation APIs
The answer rating and support escalation APIs are used to record statistics for the answers from the chat APIs. These are the endpoints you should use if you want to allow your users to rate answers, or to record statistics on support escalations.

Answer Rating
Allows users to rate answers from the chat APIs either positive, negative, or neutral (resetting the rating). This is useful for recording statistics on the answers from the chat APIs that are shown in your chat logs.

Request
This endpoint accepts a PUT request with the following parameters:

PUT https://api.docsbot.ai/teams/[teamId]/bots/[botId]/rate/[answerId]

Parameters
Parameter	Type	Description
rating	integer	-1, 0, or 1 for rating up, neutral, or down.
Examples
cURL
curl --request PUT 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/rate/O0avZ8ffTiAMRyjNrZpU' \
--header 'Content-Type: application/json' \
--data-raw '{
    "rating": -1
}'
Response
Response is a JSON object with the following properties:

true
Support Escalations
When a user escalates a chat to human support it is best practice to record that using this API call. This is useful for recording statistics on the answers from the chat APIs that are shown in your chat logs.

Request
This endpoint accepts a PUT request with the following parameters and no body:

PUT https://api.docsbot.ai/teams/[teamId]/bots/[botId]/support/[answerId]

Examples
cURL
curl --request PUT 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/support/O0avZ8ffTiAMRyjNrZpU' \
--header 'Content-Type: application/json'
Response
Response is a JSON object with the following properties:

true

Semantic Search API
The Semantic Search API can be used as a search engine for your documentation. It returns the most relevant source chunks for a given query. It can be used to create a search interface for your trained content and documentation, or to power your own custom AI creations.

Request
This endpoint accepts a POST request with the following parameters:

POST https://api.docsbot.ai/teams/[teamId]/bots/[botId]/search

Parameters
Parameter	Type	Description
query	string	The query to search for.
top_k	integer	The number of source chunks to return. Optional, default is 4.
autocut	integer/false	Autocut results to num groups. Optional, defaults to false
autocut behavior

Autocut introduces a maximum result counts. This method organizes results into groups based on significant distance jumps, offering a more intuitive way to segregate relevant from irrelevant data. Autocut addresses the reduction of irrelevant information fed into generative searches. Research by highlights the negative impact of irrelevant content on large language models, underscoring the importance of precision in search results. Autocut's design is rooted in the concept of intuitively "cutting" search results at natural breaks, improving AI-driven search efficiencies. When enabled, autocut will return the top num groups of results trimmed by the top_k parameter.

Examples
cURL
curl --request POST 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/search' \
--header 'Content-Type: application/json' \
--data-raw '{
    "query": "What is WordPress?",
    "top_k": 4
}'
JavaScript (Fetch)
var myHeaders = new Headers()
myHeaders.append('Content-Type', 'application/json')

var raw = JSON.stringify({
  query: 'What is WordPress?',
})

var requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: raw,
  redirect: 'follow',
}

fetch(
  'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/search',
  requestOptions
)
  .then((response) => response.text())
  .then((result) => console.log(result))
  .catch((error) => console.log('error', error))
PHP (cURL)
<?php

$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => 'https://api.docsbot.ai/teams/ZrbLG98bbxZ9EFqiPvyl/bots/oFFiXuQsakcqyEdpLvCB/search',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 1,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS =>'{
    "query": "What is WordPress?",
    "top_k": 4
}',
  CURLOPT_HTTPHEADER => array(
    'Content-Type: application/json'
  ),
));

$response = curl_exec($curl);

curl_close($curl);
echo $response;
Response
Response is a JSON object with the following properties:

Type	Description
array	An array of source objects. Each source object contains the source type, title, url, page, and content.
The Source object
Source objects found in the sources array have the following properties:

Property	Type	Description
type	string	Can be url, document, sitemap, wp, urls, csv, etc.
title	string	The source title.
url	string/null	The url for the source as set during indexing. May be null.
page	string/null	The page for the source as set during indexing. May be null.
content	string/null	The full source text chunk content for the source as set during indexing. It may be in markdown format.
[
  {
    "title": "High-Level Overview | Learn WordPress ",
    "url": "https://learn.wordpress.org/lesson-plan/high-level-overview/",
    "page": null,
    "content": "Title: High-Level Overview | Learn WordPress \nURL: https://learn.wordpress.org/lesson-plan/high-level-overview/\n\nDescription\nThis lesson is an introduction to WordPress for people who have heard of it, but are not quite sure what it does or if it is the right tool for them. You will learn about the origins of WordPress and its evolution from a blogging platform to a full-fledged content management system. We will also look at some of its components and how they are used to build a functional website. Finally, we will talk about the third party services you will need to operate a self-hosted WordPress site.  \nObjectives\nAt the end of this lesson, you will be able to:\nOutline and describe the basic history of WordPress.Identify the differences between WordPress.com and WordPress."
  },
  {
    "title": "How to do triage on GitHub | Learn WordPress ",
    "url": "https://learn.wordpress.org/tutorial/how-to-do-triage-on-github/",
    "page": null,
    "content": "Title: How to do triage on GitHub | Learn WordPress \nURL: https://learn.wordpress.org/tutorial/how-to-do-triage-on-github/\n\nWordPress.org\n\n\n \n\n\n\n\nWordPress.org\n\n\n\n \n\n\n\nVisit our Facebook page\nVisit our Twitter account\nVisit our Instagram account\nVisit our LinkedIn account\nVisit our YouTube channel"
  },
  {
    "title": "How WordPress processes Post Content – WordPress.org Documentation",
    "url": "https://wordpress.org/documentation/article/how-wordpress-processes-post-content/",
    "page": null,
    "content": "Title: How WordPress processes Post Content – WordPress.org Documentation\nURL: https://wordpress.org/documentation/article/how-wordpress-processes-post-content/\n\nWordPress.org\n\n\n \n\n\n\n\nWordPress.org\n\n\n\n \n\n\n\nVisit our Facebook page\nVisit our Twitter account\nVisit our Instagram account\nVisit our LinkedIn account\nVisit our YouTube channel"
  },
  {
    "title": "WordPress Block Editor – WordPress.org Documentation",
    "url": "https://wordpress.org/documentation/article/wordpress-block-editor/",
    "page": null,
    "content": "Title: WordPress Block Editor – WordPress.org Documentation\nURL: https://wordpress.org/documentation/article/wordpress-block-editor/\n\nWordPress.org\n\n\n \n\n\n\n\nWordPress.org\n\n\n\n \n\n\n\nVisit our Facebook page\nVisit our Twitter account\nVisit our Instagram account\nVisit our LinkedIn account\nVisit our YouTube channel"
  }
]