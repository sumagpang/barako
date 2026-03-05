<?php
require_once 'includes/db.php';

$id = $_GET['id'] ?? null;
if (!$id) {
    header("Location: products.php");
    exit();
}

$stmt = $pdo->prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?");
$stmt->execute([$id]);
$product = $stmt->fetch();

if (!$product) {
    header("Location: products.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($product['name']); ?> - Travaza Tools</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="public/assets/css/style.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark sticky-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="index.php">TRAVAZA TOOLS</a>
        </div>
    </nav>

    <div class="container my-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="index.php">Home</a></li>
                <li class="breadcrumb-item"><a href="products.php">Products</a></li>
                <li class="breadcrumb-item active"><?php echo htmlspecialchars($product['name']); ?></li>
            </ol>
        </nav>

        <div class="row">
            <div class="col-md-6 mb-4">
                <?php if ($product['photo']): ?>
                    <img src="<?php echo htmlspecialchars($product['photo']); ?>" class="img-fluid rounded shadow" alt="<?php echo htmlspecialchars($product['name']); ?>">
                <?php else: ?>
                    <div class="bg-light border rounded d-flex align-items-center justify-content-center" style="min-height: 400px;">
                        <span class="text-muted">No Image Available</span>
                    </div>
                <?php endif; ?>
            </div>
            <div class="col-md-6">
                <h1 class="mb-2"><?php echo htmlspecialchars($product['name']); ?></h1>
                <p class="text-primary mb-4"><?php echo htmlspecialchars($product['category_name']); ?></p>

                <h5 class="border-bottom pb-2">Product Description</h5>
                <div class="product-description mb-4">
                    <?php echo nl2br(htmlspecialchars($product['description'])); ?>
                </div>

                <?php if ($product['datasheet']): ?>
                    <div class="card bg-light">
                        <div class="card-body d-flex align-items-center justify-content-between">
                            <span>Product Brochure / Datasheet</span>
                            <a href="<?php echo htmlspecialchars($product['datasheet']); ?>" class="btn btn-primary" download>Download PDF</a>
                        </div>
                    </div>
                <?php endif; ?>

                <div class="mt-5">
                    <h5>Inquiry</h5>
                    <p class="text-muted">Interested in this product? Contact us for a quote.</p>
                    <a href="mailto:info@travazatools.com?subject=Inquiry for <?php echo urlencode($product['name']); ?>" class="btn btn-success">Send Inquiry</a>
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
