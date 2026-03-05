<?php
session_start();
require_once '../includes/db.php';

if (!isset($_SESSION['admin_id'])) {
    header("Location: login.php");
    exit();
}

$id = $_GET['id'] ?? null;

if ($id) {
    // Get product details to delete files
    $stmt = $pdo->prepare("SELECT photo, datasheet FROM products WHERE id = ?");
    $stmt->execute([$id]);
    $product = $stmt->fetch();

    if ($product) {
        if ($product['photo'] && file_exists('../' . $product['photo'])) {
            unlink('../' . $product['photo']);
        }
        if ($product['datasheet'] && file_exists('../' . $product['datasheet'])) {
            unlink('../' . $product['datasheet']);
        }

        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
        $stmt->execute([$id]);
        header("Location: products.php?msg=Product deleted successfully");
        exit();
    }
}

header("Location: products.php");
exit();
?>
