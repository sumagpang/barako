function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function addIngredient(name, cost, purchaseDate, store, quantity, uom, brand) {
  var sheet = getSpreadsheet().getSheetByName("Ingredients");
  sheet.appendRow([name, cost, purchaseDate, store, quantity, uom, brand]);
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
  try {
    var sheet = getSpreadsheet().getSheetByName("Ingredients");
    if (!sheet) {
      // If the sheet doesn't exist, return an error.
      return { error: "Sheet 'Ingredients' not found. Please create it or check the name." };
    }

    var data = sheet.getDataRange().getValues();

    // If the sheet exists but is completely empty, return an empty data array.
    if (!data || data.length === 0) {
      return { data: [] };
    }

    // Process dates before sending to the client
    var processedData = data.map(function(row, index) {
      if (index === 0) return row; // Keep header row as is

      var dateCell = row[2];
      if (dateCell instanceof Date && !isNaN(dateCell.valueOf())) {
        // It's a valid Date object, format it reliably
        row[2] = dateCell.toISOString().slice(0, 10); // "YYYY-MM-DD"
      } else if (typeof dateCell === 'string' && dateCell.length > 0) {
        // Attempt to parse a string date
        var d = new Date(dateCell);
        if (!isNaN(d.valueOf())) {
          row[2] = d.toISOString().slice(0, 10);
        }
      }
      // If it's not a valid date or it's empty, leave it as is for the frontend to handle.
      return row;
    });

    return { data: processedData };

  } catch (e) {
    // Catch any other unexpected errors during sheet access.
    return { error: "An unexpected error occurred: " + e.message };
  }
}

function addRecipe(recipeName, ingredients, servings, instructions) {
  var recipeSheet = getSpreadsheet().getSheetByName("Recipes");
  var recipeIngredientsSheet = getSpreadsheet().getSheetByName("RecipeIngredients");

  // Append the main recipe details
  recipeSheet.appendRow([recipeName, servings, instructions]);

  // Append the ingredients for that recipe
  ingredients.forEach(function(ingredient) {
    recipeIngredientsSheet.appendRow([recipeName, ingredient.name, ingredient.quantity, ingredient.uom]);
  });

  return "Recipe added successfully!";
}

function getRecipesWithCost() {
  var ss = getSpreadsheet();
  var recipesSheet = ss.getSheetByName("Recipes");
  var ingredientsSheet = ss.getSheetByName("Ingredients");
  var recipeIngredientsSheet = ss.getSheetByName("RecipeIngredients");

  var recipesData = recipesSheet.getDataRange().getValues().slice(1); // Skip header
  var ingredientsData = ingredientsSheet.getDataRange().getValues().slice(1);
  var recipeIngredientsData = recipeIngredientsSheet.getDataRange().getValues().slice(1);

  // Re-use the conversion utility from getRecipeDetails
  const uomConverter = getUomConverter();

  // Create a map of the latest ingredient prices per base unit for efficiency
  var latestBaseUnitPrices = {};
  ingredientsData.forEach(function(ing) {
    var name = ing[0];
    var cost = parseFloat(ing[1]);
    var purchaseDate = new Date(ing[2]);
    var quantity = parseFloat(ing[4]);
    var uom = ing[5];

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
  });

  // Create a map of ingredients for each recipe
  var recipeIngredientsMap = {};
  recipeIngredientsData.forEach(function(ri) {
    var recipeName = ri[0];
    if (!recipeIngredientsMap[recipeName]) {
      recipeIngredientsMap[recipeName] = [];
    }
    recipeIngredientsMap[recipeName].push({
      name: ri[1],
      quantity: parseFloat(ri[2]),
      uom: ri[3]
    });
  });

  // Calculate costs for each recipe
  var results = recipesData.map(function(recipeRow) {
    var recipeName = recipeRow[0];
    var servings = parseInt(recipeRow[1], 10) || 1; // Default to 1 serving if invalid
    var ingredients = recipeIngredientsMap[recipeName] || [];
    var totalCost = 0;

    ingredients.forEach(function(ingredient) {
      var purchaseInfo = latestBaseUnitPrices[ingredient.name];
      var recipeConversionInfo = uomConverter.getConversionInfo(ingredient.uom);

      if (purchaseInfo && recipeConversionInfo && purchaseInfo.type === recipeConversionInfo.type) {
        var recipeQtyInBaseUnit = ingredient.quantity * recipeConversionInfo.factor;
        totalCost += recipeQtyInBaseUnit * purchaseInfo.price;
      }
    });

    var costPerServing = totalCost / servings;
    var suggestedSellingPrice = totalCost * 3;

    return [recipeName, totalCost, servings, costPerServing, suggestedSellingPrice];
  });

  return results;
}


function getUomConverter() {
  return {
    mass: { base: 'g', factors: { kg: 1000, g: 1, mg: 0.001 } },
    volume: { base: 'ml', factors: { l: 1000, ml: 1 } },

    getConversionInfo: function(uom) {
      if (!uom) return null;
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
}

function getRecipeDetails(recipeName) {
  const uomConverter = getUomConverter();
  var ss = getSpreadsheet();
  var recipesSheet = ss.getSheetByName("Recipes");
  var recipeIngredientsSheet = ss.getSheetByName("RecipeIngredients");
  var ingredientsSheet = ss.getSheetByName("Ingredients");

  // Find the specific recipe's details (servings, instructions)
  var recipesData = recipesSheet.getDataRange().getValues();
  var recipeInfo = {};
  for (var i = 1; i < recipesData.length; i++) {
    if (recipesData[i][0] === recipeName) {
      recipeInfo.name = recipesData[i][0];
      recipeInfo.servings = recipesData[i][1];
      recipeInfo.instructions = recipesData[i][2];
      break;
    }
  }

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
    totalCost: totalCost,
    servings: recipeInfo.servings,
    instructions: recipeInfo.instructions
  };
}
