<?php
require_once 'includes/db.php';

$categories = $pdo->query("SELECT * FROM categories LIMIT 6")->fetchAll();
$featured_products = $pdo->query("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC LIMIT 4")->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Travaza Tools | Premium Construction Tools</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="public/assets/css/style.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark sticky-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="index.php">TRAVAZA TOOLS</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item"><a class="nav-link active" href="index.php">Home</a></li>
                    <li class="nav-item"><a class="nav-link" href="products.php">Products</a></li>
                    <li class="nav-item"><a class="nav-link" href="#about">About Us</a></li>
                    <li class="nav-item"><a class="nav-link" href="#contact">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <header class="hero-section bg-primary text-white text-center py-5">
        <div class="container">
            <h1 class="display-4 fw-bold">Quality Tools for Professional Results</h1>
            <p class="lead">Leading cable and pipe tools provider for the construction industry.</p>
            <a href="products.php" class="btn btn-light btn-lg mt-3">Browse Catalog</a>
        </div>
    </header>

    <main class="container my-5">
        <section class="mb-5">
            <h2 class="section-title">Product Categories</h2>
            <div class="row g-4">
                <?php foreach ($categories as $cat): ?>
                    <div class="col-6 col-md-4 col-lg-2 text-center">
                        <a href="products.php?category=<?php echo $cat['id']; ?>" class="text-decoration-none text-dark">
                            <div class="p-4 border rounded bg-light hover-shadow">
                                <h6 class="mb-0"><?php echo htmlspecialchars($cat['name']); ?></h6>
                            </div>
                        </a>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <section>
            <h2 class="section-title">New Arrivals</h2>
            <div class="row g-4">
                <?php foreach ($featured_products as $product): ?>
                    <div class="col-md-3">
                        <div class="card product-card h-100">
                            <?php if ($product['photo']): ?>
                                <img src="<?php echo htmlspecialchars($product['photo']); ?>" class="card-img-top" alt="<?php echo htmlspecialchars($product['name']); ?>" style="height: 200px; object-fit: cover;">
                            <?php else: ?>
                                <div class="bg-secondary text-white d-flex align-items-center justify-content-center" style="height: 200px;">No Image</div>
                            <?php endif; ?>
                            <div class="card-body">
                                <small class="text-primary"><?php echo htmlspecialchars($product['category_name']); ?></small>
                                <h5 class="card-title"><?php echo htmlspecialchars($product['name']); ?></h5>
                                <a href="product_details.php?id=<?php echo $product['id']; ?>" class="btn btn-outline-primary btn-sm">View Details</a>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
                <?php if (empty($featured_products)): ?>
                    <div class="col-12 text-center">
                        <p class="text-muted">Stay tuned for new products!</p>
                    </div>
                <?php endif; ?>
            </div>
        </section>
    </main>

    <footer class="footer mt-auto">
        <div class="container text-center">
            <p>&copy; <?php echo date('Y'); ?> Travaza Tools. All Rights Reserved.</p>
            <p>
                <a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a> | <a href="admin/login.php">Admin Login</a>
            </p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
