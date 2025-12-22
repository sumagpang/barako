function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function addIngredient(name, cost, purchaseDate, store, quantity, uom) {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  sheet.appendRow([name, cost, purchaseDate, store, quantity, uom]);
  SpreadsheetApp.flush(); // Ensure the sheet is updated immediately
  return getUniqueIngredientNames(); // Return the fresh list of unique names
}

function getUniqueIngredientNames() {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  var data = sheet.getDataRange().getValues();
  var names = data.slice(1).map(function(row) { // slice(1) to skip header
    return row[0];
  });
  var uniqueNames = [...new Set(names)]; // Get unique names
  return uniqueNames.sort(); // Return sorted unique names
}

function getAllIngredientPurchases() {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  if (!sheet) {
    throw new Error("Sheet 'Ingredients' not found. Please ensure the tab is named correctly as specified in the README.");
  }
  var data = sheet.getDataRange().getValues();
  // We send all data, including the header, and let the client handle it.
  return data;
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
  // --- UoM Conversion Utility ---
  const uomConverter = {
    mass: { base: 'g', factors: { kg: 1000, g: 1, mg: 0.001 } },
    volume: { base: 'ml', factors: { l: 1000, ml: 1 } },

    getConversionInfo: function(uom) {
      uom = uom.toLowerCase();
      for (const type in this) {
        if (this[type].factors && this[type].factors[uom]) {
          return {
            type: type,
            base: this[type].base,
            factor: this[type].factors[uom]
          };
        }
      }
      return null; // Unit not supported
    }
  };

  var ss = getSpreadsheet();
  var recipeIngredientsSheet = ss.getSheetByName("RecipeIngredients");
  var ingredientsSheet = ss.getSheetByName("Ingredients");

  var recipeIngredientsData = recipeIngredientsSheet.getDataRange().getValues();
  var ingredientsData = ingredientsSheet.getDataRange().getValues();

  // Create a map of the latest ingredient prices per base unit
  var latestBaseUnitPrices = {};
  for (var i = 1; i < ingredientsData.length; i++) {
    var name = ingredientsData[i][0];
    var cost = parseFloat(ingredientsData[i][1]);
    var purchaseDate = new Date(ingredientsData[i][2]);
    var quantity = parseFloat(ingredientsData[i][4]);
    var uom = ingredientsData[i][5];

    var conversionInfo = uomConverter.getConversionInfo(uom);

    if (quantity > 0 && conversionInfo) {
      var quantityInBaseUnit = quantity * conversionInfo.factor;
      var pricePerBaseUnit = cost / quantityInBaseUnit;

      if (!latestBaseUnitPrices[name] || purchaseDate > latestBaseUnitPrices[name].date) {
        latestBaseUnitPrices[name] = {
          price: pricePerBaseUnit,
          baseUnit: conversionInfo.base,
          date: purchaseDate,
          type: conversionInfo.type
        };
      }
    }
  }

  // Get the ingredients for the specified recipe
  var recipeIngredients = [];
  for (var i = 1; i < recipeIngredientsData.length; i++) {
    if (recipeIngredientsData[i][0] === recipeName) {
      recipeIngredients.push({
        name: recipeIngredientsData[i][1],
        quantity: parseFloat(recipeIngredientsData[i][2]),
        uom: recipeIngredientsData[i][3]
      });
    }
  }

  var totalCost = 0;
  var ingredientDetails = [];

  // Calculate total cost using the pre-computed map of base unit prices
  recipeIngredients.forEach(function(ingredient) {
    var ingredientName = ingredient.name;
    var purchaseInfo = latestBaseUnitPrices[ingredientName];
    var recipeConversionInfo = uomConverter.getConversionInfo(ingredient.uom);

    var lineItem = {
      name: ingredientName,
      quantity: ingredient.quantity,
      uom: ingredient.uom,
      cost: 0,
      status: 'OK'
    };

    if (purchaseInfo && recipeConversionInfo) {
      if (purchaseInfo.type === recipeConversionInfo.type) {
        var recipeQtyInBaseUnit = ingredient.quantity * recipeConversionInfo.factor;
        var lineItemCost = recipeQtyInBaseUnit * purchaseInfo.price;
        totalCost += lineItemCost;
        lineItem.cost = lineItemCost;
        lineItem.baseUnitPrice = purchaseInfo.price;
        lineItem.baseUnit = purchaseInfo.baseUnit;
      } else {
        lineItem.status = 'Incompatible units';
      }
    } else {
      lineItem.status = 'Price or unit not found';
    }

    ingredientDetails.push(lineItem);
  });

  return {
    recipeName: recipeName,
    ingredients: ingredientDetails,
    totalCost: totalCost
  };
}
