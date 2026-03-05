<?php
require_once 'includes/db.php';

$category_id = $_GET['category'] ?? null;
$search = $_GET['search'] ?? '';

$categories = $pdo->query("SELECT * FROM categories")->fetchAll();

$query = "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1";
$params = [];

if ($category_id) {
    $query .= " AND p.category_id = ?";
    $params[] = $category_id;
}

if ($search) {
    $query .= " AND (p.name LIKE ? OR p.description LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

$query .= " ORDER BY p.name ASC";
$stmt = $pdo->prepare($query);
$stmt->execute($params);
$products = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Catalog - Travaza Tools</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="public/assets/css/style.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark sticky-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="index.php">TRAVAZA TOOLS</a>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item"><a class="nav-link" href="index.php">Home</a></li>
                    <li class="nav-item"><a class="nav-link active" href="products.php">Products</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container my-5">
        <div class="row">
            <aside class="col-md-3 mb-4">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <h5 class="card-title mb-3">Filter by Category</h5>
                        <ul class="list-group list-group-flush">
                            <a href="products.php" class="list-group-item list-group-item-action <?php echo !$category_id ? 'active' : ''; ?>">All Categories</a>
                            <?php foreach ($categories as $cat): ?>
                                <a href="products.php?category=<?php echo $cat['id']; ?>" class="list-group-item list-group-item-action <?php echo $category_id == $cat['id'] ? 'active' : ''; ?>">
                                    <?php echo htmlspecialchars($cat['name']); ?>
                                </a>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>
            </aside>

            <div class="col-md-9">
                <form class="mb-4" method="GET">
                    <div class="input-group">
                        <input type="text" name="search" class="form-control" placeholder="Search products..." value="<?php echo htmlspecialchars($search); ?>">
                        <button class="btn btn-primary" type="submit">Search</button>
                    </div>
                </form>

                <div class="row g-4">
                    <?php foreach ($products as $product): ?>
                        <div class="col-md-4">
                            <div class="card product-card h-100">
                                <?php if ($product['photo']): ?>
                                    <img src="<?php echo htmlspecialchars($product['photo']); ?>" class="card-img-top" alt="" style="height: 180px; object-fit: cover;">
                                <?php else: ?>
                                    <div class="bg-secondary text-white d-flex align-items-center justify-content-center" style="height: 180px;">No Image</div>
                                <?php endif; ?>
                                <div class="card-body">
                                    <small class="text-primary"><?php echo htmlspecialchars($product['category_name']); ?></small>
                                    <h5 class="card-title"><?php echo htmlspecialchars($product['name']); ?></h5>
                                    <a href="product_details.php?id=<?php echo $product['id']; ?>" class="btn btn-outline-primary btn-sm">View Details</a>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <?php if (empty($products)): ?>
                        <div class="col-12 text-center py-5">
                            <p class="text-muted">No products found matching your criteria.</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <footer class="footer">
        <div class="container text-center">
            <p>&copy; <?php echo date('Y'); ?> Travaza Tools. All Rights Reserved.</p>
        </div>
    </footer>
</body>
</html>
