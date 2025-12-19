function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function addIngredient(name, cost, purchaseDate, store) {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  sheet.appendRow([name, cost, purchaseDate, store]);
  return "Ingredient added successfully!";
}

function getIngredients() {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  return sheet.getDataRange().getValues();
}

function addRecipe(recipeName, ingredients) {
  var recipeSheet = getSpreadsheet().getSheetByName("Recipes");
  var recipeIngredientsSheet = getSpreadsheet().getSheetByName("RecipeIngredients");

  var recipeRow = recipeSheet.getLastRow() + 1;
  recipeSheet.getRange(recipeRow, 1).setValue(recipeName);

  ingredients.forEach(function(ingredient) {
    recipeIngredientsSheet.appendRow([recipeName, ingredient.name, ingredient.quantity]);
  });

  return "Recipe added successfully!";
}

function getRecipes() {
  var sheet = getSpreadsheet().getSheetByName("Recipes");
  return sheet.getDataRange().getValues();
}

function getRecipeDetails(recipeName) {
  var ss = getSpreadsheet();
  var recipeIngredientsSheet = ss.getSheetByName("RecipeIngredients");
  var ingredientsSheet = ss.getSheetByName("Ingredients");

  var recipeIngredientsData = recipeIngredientsSheet.getDataRange().getValues();
  var ingredientsData = ingredientsSheet.getDataRange().getValues();

  // Create a map of the latest ingredient costs for efficiency
  var latestCosts = {};
  for (var i = 1; i < ingredientsData.length; i++) {
    var name = ingredientsData[i][0];
    var cost = ingredientsData[i][1];
    var purchaseDate = new Date(ingredientsData[i][2]);

    if (!latestCosts[name] || purchaseDate > latestCosts[name].date) {
      latestCosts[name] = { cost: cost, date: purchaseDate };
    }
  }

  // Get the ingredients for the specified recipe
  var recipeIngredients = [];
  for (var i = 1; i < recipeIngredientsData.length; i++) {
    if (recipeIngredientsData[i][0] === recipeName) {
      recipeIngredients.push({
        name: recipeIngredientsData[i][1],
        quantity: recipeIngredientsData[i][2]
      });
    }
  }

  var totalCost = 0;
  var ingredientDetails = [];

  // Calculate total cost using the pre-computed map
  recipeIngredients.forEach(function(ingredient) {
    var ingredientName = ingredient.name;
    var cost = (latestCosts[ingredientName]) ? latestCosts[ingredientName].cost : 0;

    totalCost += cost * ingredient.quantity;
    ingredientDetails.push({
      name: ingredientName,
      quantity: ingredient.quantity,
      cost: cost
    });
  });

  return {
    recipeName: recipeName,
    ingredients: ingredientDetails,
    totalCost: totalCost
  };
}
