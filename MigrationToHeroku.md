Migrating my web application from Netlify to Heroku while maintaining all existing functionalities involves several steps. Below is a comprehensive multi-step plan tailored to your project structure and requirements. This plan covers setting up the Heroku environment, configuring your application, migrating serverless functions, managing environment variables, and ensuring a smooth deployment process.

---

## **Step 1: Prepare Your Project for Heroku in a New Git Branch**

### **1.1. Create and Switch to a New Git Branch**

Performing migration in a separate branch ensures that your main branch remains stable during the transition.

```bash
cd path/to/tommasodesantis-NormHelper
git checkout -b migration-to-heroku
```

### **1.2. Assess Current Project Structure**

- **Existing Structure:**
  ```
  tommasodesantis-NormHelper/
  ├── public/
  │   ├── index.html
  │   ├── styles.css
  │   ├── _headers
  │   └── app.js
  ├── package.json
  ├── OpenRouter_Docs_261224.txt
  ├── MobileExperience.md
  ├── netlify.toml
  ├── netlify/
  │   └── functions/
  │       ├── ask.js
  │       └── listFiles.js
  └── src/
  ```

- **Key Components to Migrate:**
  - **Static Assets:** `public/` directory
  - **Serverless Functions:** `netlify/functions/`
  - **Configurations:** `netlify.toml`
  - **Dependencies:** `package.json`

---

## **Step 2: Install Heroku CLI**

Ensure you have the Heroku CLI installed on your machine. If not, install it from [Heroku CLI Installation](https://devcenter.heroku.com/articles/heroku-cli).

```bash
# For macOS using Homebrew
brew tap heroku/brew && brew install heroku

# For other platforms, follow the instructions on the Heroku website.
```

---

## **Step 3: Set Up a New Heroku Application**

### **3.1. Log in to Heroku**

Authenticate with Heroku using the CLI.

```bash
heroku login
```

Follow the prompts to complete the authentication.

### **3.2. Create a New Heroku App**

Navigate to your project directory and create a new Heroku app.

```bash
heroku create your-app-name
```

*Replace `your-app-name` with a unique name or leave it blank to let Heroku generate one.*

---

## **Step 4: Configure `package.json` for Heroku**

Heroku uses the `package.json` file to determine how to build and run your application.

### **4.1. Add a Start Script**

Heroku needs a `start` script to run your application. Modify your `package.json` as follows:

```json
{
  "name": "Normio",
  "version": "1.0.0",
  "description": "Normatives Assistant",
  "main": "server.js", // Change from app.js to server.js
  "scripts": {
    "start": "node server.js",
    "dev": "heroku local" // Updated from 'netlify dev' to 'heroku local'
  },
  "dependencies": {
    "express": "^4.18.2", // Add Express.js for handling server routes
    "node-fetch": "^2.7.0"
  },
  "devDependencies": {
    "heroku-cli-local": "^0.2.0" // Install Heroku local development tool
  }
}
```

**Notes:**

- **Express.js:** Introduced to handle server routes on Heroku.
- **Heroku Local:** Replaces `netlify dev` to emulate the Heroku environment locally.
  
### **4.2. Install Required Dependencies**

Install Express.js and `heroku-cli-local` for local development.

```bash
npm install express
npm install --save-dev heroku-cli-local
```

---

## **Step 5: Migrate Netlify Functions to Express Routes**

Heroku doesn't use serverless functions like Netlify. Instead, you'll set up an Express server to handle these routes.

### **5.1. Create `server.js`**

In the root of your project, create a `server.js` file with the following content:

```javascript
// server.js

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config(); // To manage environment variables

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Route: /api/ask
 * Method: POST
 * Description: Handles AI questioning
 */
app.post('/api/ask', async (req, res) => {
  try {
    const { question, fileName, model } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'No text file specified.' });
    }

    if (!model) {
      return res.status(400).json({ error: 'No AI model specified.' });
    }

    // Import texts from src/texts.js (existing and properly set)
    const texts = require('./src/texts');
    if (!texts[fileName]) {
      return res.status(404).json({ error: 'Specified text file does not exist.' });
    }

    const textContent = texts[fileName].trim();
    if (!textContent) {
      return res.status(400).json({ error: 'The provided text file is empty.' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant specialized in analyzing technical engineering documents. ' +
                  'You have been given a text document to analyze. Please read it carefully and provide detailed, accurate answers. ' +
                  'For every statement you make, cite the specific section or paragraph number(s) in parentheses and the page at the end of the relevant sentence. ' +
                  'For statements combining information from multiple sections, cite all relevant sections and pages. ' +
                  'If you are unsure about a section number, indicate this clearly.' +
                  'When analyzing the document titled "DECRETO 31 luglio 2012. Approvazione delle Appendici nazionali recanti i parametri tecnici per l applicazione degli Eurocodici," note that due to the poor resolution of the original document, there may be some errors in symbols or contents in the answers provided; IMPORTANT: at the end of each answer related to this particular document (dont do that for other documents!), always inform inform the user about this issue and advice them to consult the original document at the page(s) and section(s) provided.' +
                  'Use appropriate Markdown syntax for headers, tables, emphasis, and lists where applicable.'
          },
          {
            type: 'text',
            text: textContent,
            cache_control: {
              type: 'ephemeral'
            }
          }
        ]
      },
      {
        role: 'user',
        content: question
      }
    ];

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'NormHelper' // Optional: Customize as needed
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.1
      })
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || openRouterResponse.statusText;
      console.error('OpenRouter request failed:', {
        status: openRouterResponse.status,
        statusText: openRouterResponse.statusText,
        errorMessage
      });
      return res.status(openRouterResponse.status).json({ error: `OpenRouter request failed: ${errorMessage}` });
    }

    const data = await openRouterResponse.json().catch(() => null);
    if (!data || !Array.isArray(data.choices) || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      return res.status(500).json({ error: 'Invalid response from OpenRouter.' });
    }

    res.status(200).json({ answer: data.choices[0].message.content });
  } catch (error) {
    console.error('Error in /api/ask:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again later.',
      details: error.toString()
    });
  }
});

/**
 * Route: /api/listFiles
 * Method: GET
 * Description: Lists available text files
 */
app.get('/api/listFiles', (req, res) => {
  try {
    const texts = require('./src/texts');
    const files = Object.keys(texts);
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error in /api/listFiles:', error);
    res.status(500).json({ error: 'Unable to list text files.' });
  }
});

// Fallback Route to Serve index.html for Client-Side Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

### **5.2. Remove Netlify-Specific Files**

Since you're migrating to Heroku, Netlify-specific configurations are unnecessary.

- **Delete:**
  - `netlify.toml`
  - `netlify/functions/` directory

```bash
rm -rf netlify.toml netlify/functions/
```

---

## **Step 6: Update HTML to Point to New API Endpoints**

Your current frontend fetches serverless functions at `/.netlify/functions/`. Update these to point to your new Heroku endpoints.

### **6.1. Modify `public/app.js`**

Change API endpoints from Netlify to your Heroku app's domain. Assuming your frontend and backend are served from the same Heroku app, you can use relative paths.

```javascript
// Update fetch URLs from Netlify to Heroku
// Example: Replace '/.netlify/functions/listFiles' with '/api/listFiles'

document.addEventListener('DOMContentLoaded', async () => {
  // Existing code...

  try {
    console.log('Fetching file list...');
    const response = await fetch('/api/listFiles'); // Changed path

    // Existing code...
  } catch (error) {
    // Existing error handling...
  }
});

// Similarly, update the 'ask' function fetch call
async function handleSendMessage() {
  // Existing code...

  try {
    // Existing validations...

    console.log('Sending request with:', {
      question,
      fileName: fileSelect.value,
      model: llmSelect.value
    });

    // Show typing indicator...

    // Update the API endpoint
    response = await fetch('/api/ask', { // Changed path
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        fileName: fileSelect.value,
        model: llmSelect.value
      }),
    });

    // Existing response handling...
  } catch (error) {
    // Existing error handling...
  }

  // Existing code...
}
```

**Note:** If your Heroku app uses a custom domain, replace `/api/ask` with `https://your-custom-domain.com/api/ask`. Otherwise, relative paths suffice.

---

## **Step 7: Manage Environment Variables**

Heroku uses environment variables to manage sensitive data like API keys.

### **7.1. Remove Environment Variables from Code**

Ensure that sensitive data like `OPENROUTER_API_KEY` is not hard-coded or stored in your codebase.

### **7.2. Set Environment Variables on Heroku**

Use the Heroku CLI to set environment variables.

```bash
heroku config:set OPENROUTER_API_KEY=your_openrouter_api_key
heroku config:set SITE_URL=https://your-app-name.herokuapp.com
```

*Replace `your_openrouter_api_key` and `your-app-name` with your actual API key and Heroku app name respectively.*

---

## **Step 8: Set Up Buildpacks and Dependencies**

Heroku automatically detects Node.js applications by the presence of `package.json`. Ensure all dependencies are correctly listed.

### **8.1. Verify `package.json` Dependencies**

Ensure that all necessary packages are included.

```json
"dependencies": {
  "express": "^4.18.2",
  "node-fetch": "^2.7.0"
},
"devDependencies": {
  "heroku-cli-local": "^0.2.0"
}
```

**Note:** You can remove `netlify-cli` if it's no longer needed.

### **8.2. Create a `.gitignore` File**

Ensure sensitive files like `.env` are not committed to your repository.

```bash
touch .gitignore
```

Add the following to `.gitignore`:

```
node_modules/
.env
```

---

## **Step 9: Initialize Git Repository (If Not Already Done)**

Heroku deploys applications via Git.

### **9.1. Commit Changes to Git**

Ensure all changes are committed to the new branch.

```bash
git add .
git commit -m "Prepare project for Heroku deployment"
```

### **9.2. Set Up Heroku Remote**

If not already set, add Heroku as a remote repository.

```bash
heroku git:remote -a your-app-name
```

*Replace `your-app-name` with your actual Heroku app name.*

---

## **Step 10: Deploy to Heroku**

### **10.1. Push Code to Heroku**

Deploy your application by pushing the code to Heroku.

```bash
git push heroku migration-to-heroku:main
```

*Assuming `main` is your default branch. If your default branch is `master`, replace `main` with `master`.*

### **10.2. Monitor Deployment Logs**

Ensure there are no errors during deployment. Look out for messages indicating that the server has started.

```bash
heroku logs --tail
```

---

## **Step 11: Test Your Application on Heroku**

### **11.1. Access Your Heroku App**

Open your app in the browser:

```bash
heroku open
```

### **11.2. Verify Functionality**

- **Static Assets:**
  - Ensure `index.html`, `styles.css`, and `app.js` are loading correctly.

- **AI Chat Functionality:**
  - Select a normative document and AI model.
  - Ask a question and verify the response.
  - Ensure that API calls to `/api/ask` and `/api/listFiles` work as expected.

- **Mobile Responsiveness:**
  - Test the UI on different devices and screen sizes to ensure responsiveness.

### **11.3. Debug Issues**

If any functionality doesn't work as expected:

- **Check Server Logs:**

  ```bash
  heroku logs --tail
  ```

- **Common Issues to Address:**
  - **CORS Errors:** Ensure your Express server handles CORS if your frontend and backend are on different domains.
  - **Environment Variables:** Verify that all necessary environment variables are set.
  - **File Paths:** Ensure that paths to assets and API endpoints are correct.

---

## **Step 12: Optimize and Enhance**

### **12.1. Set Up a Procfile (Optional)**

Though Heroku can detect the app type, explicitly defining a Procfile can help.

Create a `Procfile` in the root directory:

```bash
touch Procfile
```

Add the following content:

```
web: node server.js
```

### **12.2. Enable Automatic Deployments (Optional)**

For continuous integration, link your GitHub repository to Heroku for automatic deployments on every push.

- **Navigate to Heroku Dashboard:**
  - Go to your app's dashboard.
  - Click on the "Deploy" tab.
  - Connect to GitHub and select your repository.
  - Enable automatic deployments.

### **12.3. Implement a Custom Domain (Optional)**

If you have a custom domain, configure it on Heroku.

- **Add Domain:**

  ```bash
  heroku domains:add www.yourcustomdomain.com
  ```

- **Configure DNS:**
  - Update your domain's DNS settings to point to Heroku's DNS targets as instructed in the Heroku dashboard.

### **12.4. Secure Your Application**

- **Enable HTTPS:**
  - Heroku provides free SSL certificates for custom domains.

- **Set Environment to Production:**
  - In `server.js`, ensure Express is running in production mode.

  ```javascript
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    app.use(express.static(path.join(__dirname, 'public'), {
      maxAge: '1y',
      etag: false
    }));
  }
  ```

- **Handle Errors Gracefully:**
  - Implement better error handling and user-friendly messages.

---

## **Step 13: Remove Unnecessary Netlify Configurations (Cleanup)**

After ensuring everything works on Heroku:

- **Delete Netlify Files:**

  ```bash
  rm -rf netlify.toml netlify/
  ```

- **Update Documentation:**
  - Modify `MobileExperience.md` and any other documentation to reflect Heroku deployment steps.

---

## **Step 14: Monitor and Maintain**

### **14.1. Set Up Monitoring Tools**

Use Heroku add-ons or external services to monitor application performance.

- **Heroku Metrics:** Available on the Heroku dashboard.
- **Third-Party Tools:** New Relic, Papertrail, etc.

### **14.2. Implement Logging**

Ensure your `server.js` logs important events and errors for easier debugging.

### **14.3. Regularly Update Dependencies**

Keep your `package.json` dependencies up-to-date to benefit from security patches and improvements.

```bash
npm outdated
npm update
```

### **14.4. Backup and Version Control**

Ensure your code is version-controlled using Git and that backups are in place.

---

## **Summary of Changes**

### **Files to Create or Modify:**

- **Create:**
  - `server.js`
  - `.gitignore` (if not existing)
  - `Procfile` (optional)

- **Modify:**
  - `package.json`
  - `public/app.js` (update fetch URLs)
  
- **Delete:**
  - `netlify.toml`
  - `netlify/` directory

### **Key Points:**

- **Git Branching:** Perform migration in a separate Git branch to maintain stability.
- **Server Configuration:** Transition from Netlify's serverless functions to Express routes.
- **Local Development:** Use `heroku local` for local testing instead of `netlify dev`.
- **Environment Variables:** Securely manage API keys and configurations on Heroku.
- **Static Assets:** Serve static files using Express.
- **Routing:** Ensure client-side routing works with Heroku's server setup.
- **Deployment:** Utilize Git for seamless deployment and updates.
- **Testing:** Rigorously test all functionalities post-migration.

---

## **Additional Recommendations**

- **Use Modern CSS Features:** Consider using Flexbox and CSS Grid for more flexible layouts, which can further enhance responsiveness.
  
- **Optimize Images:** Use responsive image techniques like `srcset` to serve appropriate image sizes based on device resolution.

- **Leverage CSS Variables:** Simplify theme and layout adjustments by using CSS variables for colors, spacings, and other recurrent values.

- **Ensure Fast Load Times:** Utilize tools like [Lighthouse](https://developers.google.com/web/tools/lighthouse) to audit and improve your site's performance, accessibility, and SEO.

---

By following this updated detailed plan, your application should transition smoothly from Netlify to Heroku without any loss of functionality. This setup leverages Heroku's robust platform to manage your application's backend needs while maintaining the frontend user experience. Remember to thoroughly test each step and monitor your application post-deployment to address any unforeseen issues promptly.

If you encounter specific issues during the migration, consider consulting Heroku's [official documentation](https://devcenter.heroku.com/) or reaching out to their support for assistance.