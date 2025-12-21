# Google Apps Script Recipe Book

This web application allows you to create a recipe book that tracks ingredient costs and automatically calculates the total cost of a recipe based on the latest ingredient prices.

## Setup Instructions

### 1. Create a Google Sheet

1.  Create a new Google Sheet.
2.  Rename the sheet to "Recipe Book" or a name of your choice.
3.  Create three tabs within the sheet named `Ingredients`, `Recipes`, and `RecipeIngredients`.
4.  Set up the headers for each tab as follows:
    *   **Ingredients:** `Name`, `Cost`, `Purchase Date`, `Store`, `Quantity`, `UoM`
    *   **Recipes:** `Recipe Name`
    *   **RecipeIngredients:** `Recipe Name`, `Ingredient Name`, `Quantity`, `UoM`

### 2. Create a Google Apps Script Project

1.  Open the Google Sheet you just created.
2.  Go to `Extensions > Apps Script`.
3.  Copy the content of `Code.gs` from this repository and paste it into the `Code.gs` file in the Apps Script editor.
4.  Click the `+` icon in the `Files` sidebar and select `HTML`. Name the file `index.html`.
5.  Copy the content of `index.html` from this repository and paste it into the `index.html` file you just created.

### 3. Deploy the Web App

1.  In the Apps Script editor, click `Deploy > New deployment`.
2.  Select `Web app` as the deployment type.
3.  In the `Description` field, enter a description for your web app.
4.  Under `Who has access`, select `Anyone with Google account` or `Anyone` depending on your preference.
5.  Click `Deploy`.
6.  Authorize the script to access your Google Sheet.
7.  Copy the `Web app URL` provided. This is the URL to your recipe book.
