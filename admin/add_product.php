<?php
session_start();
require_once '../includes/db.php';

if (!isset($_SESSION['admin_id'])) {
    header("Location: login.php");
    exit();
}

$categories = $pdo->query("SELECT * FROM categories")->fetchAll();
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = $_POST['name'] ?? '';
    $category_id = $_POST['category_id'] ?? '';
    $description = $_POST['description'] ?? '';

    $photo_path = '';
    $datasheet_path = '';

    // Handle Photo Upload
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
        $allowed_photo_ext = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));

        if (in_array($ext, $allowed_photo_ext)) {
            $filename = uniqid() . '.' . $ext;
            $target = '../' . UPLOAD_PATH_PHOTOS . $filename;
            if (move_uploaded_file($_FILES['photo']['tmp_name'], $target)) {
                $photo_path = UPLOAD_PATH_PHOTOS . $filename;
            }
        } else {
            $error = "Invalid photo format. Allowed: " . implode(', ', $allowed_photo_ext);
        }
    }

    // Handle Datasheet Upload
    if (!$error && isset($_FILES['datasheet']) && $_FILES['datasheet']['error'] === UPLOAD_ERR_OK) {
        $allowed_doc_ext = ['pdf', 'doc', 'docx'];
        $ext = strtolower(pathinfo($_FILES['datasheet']['name'], PATHINFO_EXTENSION));

        if (in_array($ext, $allowed_doc_ext)) {
            $filename = uniqid() . '.' . $ext;
            $target = '../' . UPLOAD_PATH_DATASHEETS . $filename;
            if (move_uploaded_file($_FILES['datasheet']['tmp_name'], $target)) {
                $datasheet_path = UPLOAD_PATH_DATASHEETS . $filename;
            }
        } else {
            $error = "Invalid datasheet format. Allowed: " . implode(', ', $allowed_doc_ext);
        }
    }

    if ($name && $category_id) {
        $stmt = $pdo->prepare("INSERT INTO products (category_id, name, description, photo, datasheet) VALUES (?, ?, ?, ?, ?)");
        if ($stmt->execute([$category_id, $name, $description, $photo_path, $datasheet_path])) {
            header("Location: products.php?msg=Product added successfully");
            exit();
        } else {
            $error = "Failed to add product.";
        }
    } else {
        $error = "Name and Category are required.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Product - Travaza Admin</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-4">
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card shadow">
                    <div class="card-header bg-success text-white">
                        <h4>Add New Product</h4>
                    </div>
                    <div class="card-body">
                        <?php if ($error): ?>
                            <div class="alert alert-danger"><?php echo $error; ?></div>
                        <?php endif; ?>
                        <form method="POST" enctype="multipart/form-data">
                            <div class="mb-3">
                                <label class="form-label">Product Name</label>
                                <input type="text" name="name" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Category</label>
                                <select name="category_id" class="form-select" required>
                                    <option value="">Select Category</option>
                                    <?php foreach ($categories as $cat): ?>
                                        <option value="<?php echo $cat['id']; ?>"><?php echo htmlspecialchars($cat['name']); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Description</label>
                                <textarea name="description" class="form-control" rows="4"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Product Photo</label>
                                <input type="file" name="photo" class="form-control" accept="image/*">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Product Datasheet (PDF/Brochure)</label>
                                <input type="file" name="datasheet" class="form-control" accept=".pdf,.doc,.docx">
                            </div>
                            <div class="d-flex justify-content-between">
                                <a href="products.php" class="btn btn-secondary">Cancel</a>
                                <button type="submit" class="btn btn-success">Save Product</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
