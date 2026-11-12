import os
import sys
import numpy as np
import json
from PIL import Image
import torch

# Force HuggingFace offline mode since weights are cached
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from transformers import CLIPProcessor, CLIPModel
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from scipy.optimize import minimize
import joblib

def main():
    print("================================================================================")
    print("CIVICSENSE AI — STEP 1 CATEGORY CLASSIFIER (CLIP ViT-B/32 + LOGISTIC REGRESSION)")
    print("================================================================================")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    model_id = "openai/clip-vit-base-patch32"
    print(f"Loading cached CLIP model '{model_id}'...")
    clip_model = CLIPModel.from_pretrained(model_id, local_files_only=True).to(device)
    clip_processor = CLIPProcessor.from_pretrained(model_id, local_files_only=True)
    clip_model.eval()

    base_dir = "Real Test Datas"
    folders = ["Flood", "Garbage", "Pathole"]

    images = []
    labels = []
    filenames = []
    metadata = []

    # Class mapping: 0: FLOOD, 1: GARBAGE, 2: POTHOLE
    class_names = ["FLOOD", "GARBAGE", "POTHOLE"]

    for class_idx, folder in enumerate(folders):
        fdir = os.path.join(base_dir, folder)
        if not os.path.exists(fdir):
            print(f"Warning: {fdir} does not exist!")
            continue
        for fname in sorted(os.listdir(fdir)):
            fpath = os.path.join(fdir, fname)
            try:
                im = Image.open(fpath).convert("RGB")
                # Exclude clean road negative control from training the 3 hazard classes
                if fname == "road without pothole.webp":
                    print(f"Excluding negative control '{fname}' from 3-class training (reserved for OTHER/clean evaluation)")
                    continue
                images.append(im)
                labels.append(class_idx)
                filenames.append(fname)
                metadata.append({"filename": fname, "folder": folder, "path": fpath, "label": class_names[class_idx]})
            except Exception as e:
                print(f"Error loading {fpath}: {e}")

    class_counts = dict(zip(class_names, np.bincount(labels)))
    print(f"\nLoaded {len(images)} civic hazard images across {len(class_names)} classes: {class_counts}")

    # Extract CLIP image embeddings
    print("\nExtracting CLIP image embeddings in batches...")
    batch_size = 16
    image_features_list = []

    with torch.no_grad():
        for i in range(0, len(images), batch_size):
            batch_imgs = images[i:i+batch_size]
            inputs = clip_processor(images=batch_imgs, return_tensors="pt").to(device)
            feats = clip_model.get_image_features(**inputs)
            if hasattr(feats, "pooler_output"):
                feats = feats.pooler_output
            feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
            image_features_list.append(feats.cpu().numpy())

    X = np.vstack(image_features_list)
    y = np.array(labels)
    print(f"Extracted feature matrix shape: {X.shape}")

    # Text prompt zero-shot anchors
    text_prompts = [
        "a flooded street with standing muddy water, puddles, or submerged road",
        "a pile of garbage bags, plastic trash, litter, and municipal waste",
        "a pothole crater, road cavity, asphalt crack, or damaged road surface",
        "a normal clean paved asphalt road with no defects, no water, and no trash"
    ]
    print("\nExtracting text embeddings for zero-shot anchor classes (including clean road)...")
    text_inputs = clip_processor(text=text_prompts, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        text_feats = clip_model.get_text_features(**text_inputs)
        if hasattr(text_feats, "pooler_output"):
            text_feats = text_feats.pooler_output
        text_feats = text_feats / text_feats.norm(p=2, dim=-1, keepdim=True)
        text_features_np = text_feats.cpu().numpy()

    # Stratified 5-Fold Cross-Validation
    print("\nRunning Stratified 5-Fold Cross-Validation...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_preds = np.zeros(len(y), dtype=int)
    cv_probs = np.zeros((len(y), len(class_names)))

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), 1):
        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]
        
        clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
        clf.fit(X_train, y_train)
        
        val_probs = clf.predict_proba(X_val)
        val_preds = clf.predict(X_val)
        
        cv_preds[val_idx] = val_preds
        cv_probs[val_idx] = val_probs
        fold_acc = accuracy_score(y_val, val_preds)
        print(f"  Fold {fold}: Accuracy = {fold_acc*100:.2f}% ({len(val_idx)} validation images)")

    overall_acc = accuracy_score(y, cv_preds)
    print(f"\n=======================================================")
    print(f"5-Fold CV Overall Accuracy: {overall_acc*100:.2f}%")
    print(f"=======================================================")

    print("\nClassification Report (5-Fold CV Out-of-Fold Predictions):")
    report = classification_report(y, cv_preds, target_names=class_names, digits=4, output_dict=True)
    print(classification_report(y, cv_preds, target_names=class_names, digits=4))

    print("Confusion Matrix:")
    cm = confusion_matrix(y, cv_preds)
    print(f"{'':>12} | Pred FLOOD | Pred GARBAGE | Pred POTHOLE")
    print("-" * 52)
    for i, name in enumerate(class_names):
        print(f"{name:>12} | {cm[i][0]:>10} | {cm[i][1]:>12} | {cm[i][2]:>12}")

    # Expected Calibration Error (ECE)
    def compute_ece(probs, true_labels, n_bins=10):
        confidences = np.max(probs, axis=1)
        predictions = np.argmax(probs, axis=1)
        accuracies = (predictions == true_labels)
        
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        ece = 0.0
        for bin_lower, bin_upper in zip(bin_boundaries[:-1], bin_boundaries[1:]):
            in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
            prop_in_bin = np.mean(in_bin)
            if prop_in_bin > 0:
                accuracy_in_bin = np.mean(accuracies[in_bin])
                avg_confidence_in_bin = np.mean(confidences[in_bin])
                ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
        return ece

    ece_before = compute_ece(cv_probs, y)

    # Temperature Scaling optimization
    def temperature_scaling_loss(T, logits, labels):
        scaled_logits = logits / T
        exp_l = np.exp(scaled_logits - np.max(scaled_logits, axis=1, keepdims=True))
        p = exp_l / np.sum(exp_l, axis=1, keepdims=True)
        nll = -np.mean(np.log(np.clip(p[np.arange(len(labels)), labels], 1e-12, 1.0)))
        return nll

    pseudo_logits = np.log(np.clip(cv_probs, 1e-12, 1.0))
    res = minimize(temperature_scaling_loss, x0=[1.0], args=(pseudo_logits, y), bounds=[(0.1, 10.0)])
    best_T = float(res.x[0])

    calib_logits = pseudo_logits / best_T
    exp_calib = np.exp(calib_logits - np.max(calib_logits, axis=1, keepdims=True))
    calib_probs = exp_calib / np.sum(exp_calib, axis=1, keepdims=True)
    ece_after = compute_ece(calib_probs, y)

    print(f"\nCalibration Metrics:")
    print(f"  Optimal Temperature (T): {best_T:.4f}")
    print(f"  ECE Before Calibration:  {ece_before*100:.2f}%")
    print(f"  ECE After Calibration:   {ece_after*100:.2f}%")

    # Final classifier fit
    print("\nTraining final production classifier on all 93 training images...")
    final_clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
    final_clf.fit(X, y)

    os.makedirs("models", exist_ok=True)
    artifact = {
        "model_name": "CLIP_ViT_B32_LogisticRegression_CivicSense",
        "class_names": class_names,
        "classifier": final_clf,
        "temperature": best_T,
        "ece_before": ece_before,
        "ece_after": ece_after,
        "cv_accuracy": overall_acc,
        "text_features": text_features_np,
        "text_prompts": text_prompts
    }
    joblib.dump(artifact, "models/category_classifier.joblib")
    print("Saved classifier artifact to 'models/category_classifier.joblib'")

    summary = {
        "cv_accuracy": round(float(overall_acc), 4),
        "ece_before_pct": round(float(ece_before * 100), 2),
        "ece_after_pct": round(float(ece_after * 100), 2),
        "optimal_temperature": round(float(best_T), 4),
        "confusion_matrix": cm.tolist(),
        "class_names": class_names,
        "sample_count": len(y),
        "classification_report": report
    }
    with open("models/category_classifier_metrics.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("Saved metrics summary to 'models/category_classifier_metrics.json'")
    print("\nTraining complete!")

if __name__ == "__main__":
    main()

