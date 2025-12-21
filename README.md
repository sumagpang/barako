# Google Apps Script Recipe Book

This web application allows you to create a recipe book that tracks ingredient costs and automatically calculates the total cost of a recipe based on the latest ingredient prices.

## Features

*   **Ingredient Tracking:** Record all your ingredient purchases, including the cost, quantity, unit of measure (UoM), purchase date, and store.
*   **Recipe Management:** Create and manage your recipes, specifying the required quantity and UoM for each ingredient.
*   **Automatic Cost Calculation:** The application automatically calculates the total cost of any recipe. It intelligently finds the most recent purchase price for each ingredient and calculates a price per base unit (e.g., price per gram or per milliliter).
*   **Automatic UoM Conversion:** The application can automatically convert between compatible units of measurement. This means you can buy an ingredient in kilograms but use it in your recipes in grams, and the cost will be calculated correctly.

### Supported Units of Measurement

The application supports the following units for automatic conversion:

*   **Mass:** `kg` (kilogram), `g` (gram), `mg` (milligram)
*   **Volume:** `l` (liter), `ml` (milliliter)

The system will report an error if you try to use incompatible units in a recipe (e.g., buying flour in `kg` but using it in a recipe in `l`).

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
