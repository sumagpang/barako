function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function addIngredient(name, cost, purchaseDate, store, quantity, uom) {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  sheet.appendRow([name, cost, purchaseDate, store, quantity, uom]);
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
    recipeIngredientsSheet.appendRow([recipeName, ingredient.name, ingredient.quantity, ingredient.uom]);
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

  // Create a map of the latest ingredient unit prices for efficiency
  // Ingredients sheet headers: Name, Cost, Purchase Date, Store, Quantity, UoM
  var latestUnitPrices = {};
  for (var i = 1; i < ingredientsData.length; i++) {
    var name = ingredientsData[i][0];
    var cost = ingredientsData[i][1];
    var purchaseDate = new Date(ingredientsData[i][2]);
    var quantity = ingredientsData[i][4];
    var uom = ingredientsData[i][5];

    if (quantity > 0) { // Avoid division by zero
      var unitPrice = cost / quantity;
      if (!latestUnitPrices[name] || purchaseDate > latestUnitPrices[name].date) {
        latestUnitPrices[name] = { unitPrice: unitPrice, date: purchaseDate, uom: uom };
      }
    }
  }

  // Get the ingredients for the specified recipe
  // RecipeIngredients sheet headers: Recipe Name, Ingredient Name, Quantity, UoM
  var recipeIngredients = [];
  for (var i = 1; i < recipeIngredientsData.length; i++) {
    if (recipeIngredientsData[i][0] === recipeName) {
      recipeIngredients.push({
        name: recipeIngredientsData[i][1],
        quantity: recipeIngredientsData[i][2],
        uom: recipeIngredientsData[i][3]
      });
    }
  }

  var totalCost = 0;
  var ingredientDetails = [];

  // Calculate total cost using the pre-computed map of unit prices
  recipeIngredients.forEach(function(ingredient) {
    var ingredientName = ingredient.name;
    var purchaseInfo = latestUnitPrices[ingredientName];
    var unitPrice = purchaseInfo ? purchaseInfo.unitPrice : 0;

    // Note: This calculation assumes the UoM for the recipe ingredient is compatible
    // with the UoM from the ingredient purchase. A more advanced implementation
    // would handle unit conversions.
    var lineItemCost = unitPrice * ingredient.quantity;
    totalCost += lineItemCost;

    ingredientDetails.push({
      name: ingredientName,
      quantity: ingredient.quantity,
      uom: ingredient.uom,
      cost: lineItemCost,
      unitPrice: unitPrice,
      purchaseUom: purchaseInfo ? purchaseInfo.uom : 'N/A'
    });
  });

  return {
    recipeName: recipeName,
    ingredients: ingredientDetails,
    totalCost: totalCost
  };
}
