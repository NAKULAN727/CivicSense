import os
import json
import numpy as np
from PIL import Image
import gradio as gr

# Prevent network timeouts for analytics & suppress distributed warnings
os.environ["GRADIO_ANALYTICS_ENABLED"] = "False"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TORCH_CPP_LOG_LEVEL"] = "ERROR"

from detectors import CivicSenseEngine

print("Starting CivicSense AI Gradio Web Application...")
# Pre-load all models once at startup
engine = CivicSenseEngine.get_instance()

def predict_single_image(input_img):
    if input_img is None:
        return (
            None,
            "<div style='padding: 12px; color: #64748b;'>Upload an image to begin incident analysis.</div>",
            "<div style='padding: 12px; color: #64748b;'>Awaiting input...</div>",
            "0.0%",
            "Please select an example image or upload a street photo.",
            {}
        )
        
    try:
        annotated_im, payload = engine.process_image(input_img)
        
        cat = payload["category"]
        cat_conf = payload["category_confidence"]
        inc_type = payload["type"]
        type_conf = payload["type_confidence"]
        water_cov = payload["water_coverage_pct"]
        warnings = payload["warnings"]
        
        # Color coding for category badge
        badge_colors = {
            "FLOOD": "#0284c7",    # Sky Blue
            "GARBAGE": "#16a34a",  # Green
            "POTHOLE": "#dc2626",  # Red
            "OTHER": "#4b5563",    # Slate Grey
            "UNCERTAIN": "#d97706" # Amber
        }
        color = badge_colors.get(cat, "#4b5563")
        
        # HTML formatting for Category Card
        cat_html = f"""
        <div style="background-color: {color}15; border-left: 6px solid {color}; padding: 14px 18px; border-radius: 8px; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: {color};">
                Identified Category
            </div>
            <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 4px;">
                <span style="font-size: 24px; font-weight: 800; color: #111827;">{cat}</span>
                <span style="font-size: 20px; font-weight: 700; color: {color};">{cat_conf * 100:.1f}% Conf.</span>
            </div>
            <div style="margin-top: 6px; background-color: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
                <div style="background-color: {color}; width: {min(100.0, cat_conf * 100):.1f}%; height: 100%;"></div>
            </div>
        </div>
        """
        
        # HTML formatting for Incident Type Card
        type_html = f"""
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 8px; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
                Incident Classification & Taxonomy
            </div>
            <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 4px;">
                <span style="font-size: 20px; font-weight: 700; color: #0f172a;">{inc_type}</span>
                <span style="font-size: 18px; font-weight: 600; color: #334155;">{type_conf * 100:.1f}%</span>
            </div>
            <div style="margin-top: 6px; background-color: #e2e8f0; border-radius: 9999px; height: 6px; overflow: hidden;">
                <div style="background-color: #0284c7; width: {min(100.0, type_conf * 100):.1f}%; height: 100%;"></div>
            </div>
        </div>
        """
        
        # Warnings formatting
        if len(warnings) == 0:
            warn_md = "🟢 **No anomalous conditions or data warnings.** Incident analysis confirmed."
        else:
            warn_items = "\n".join([f"- ⚠️ **{w}**" for w in warnings])
            warn_md = f"### System Diagnostics & Operational Warnings\n{warn_items}"
            
        water_str = f"{water_cov:.1f}%"
        
        return annotated_im, cat_html, type_html, water_str, warn_md, payload
        
    except Exception as e:
        err_msg = f"Error during inference: {str(e)}"
        return None, f"<div style='color:red;'>{err_msg}</div>", "", "0.0%", err_msg, {"error": str(e)}

# Available sample images for Gradio Quick Testing
example_images = [
    ["Real Test Datas/Flood/flood 14.webp"],
    ["Real Test Datas/Flood/flood 1.jpg"],
    ["Real Test Datas/Garbage/garbage 1.webp"],
    ["Real Test Datas/Garbage/garbage 5.webp"],
    ["Real Test Datas/Pathole/pathole 1.webp"],
    ["Real Test Datas/Pathole/water filled patholes.jpg"],
    ["Real Test Datas/Pathole/road without pothole.webp"]
]
valid_examples = [[p[0]] for p in example_images if os.path.exists(p[0])]

custom_theme = gr.themes.Soft(
    primary_hue="blue",
    secondary_hue="slate"
)

with gr.Blocks(title="CivicSense AI — Incident Detector") as demo:
    gr.Markdown(
        """
        # 🏙️ CivicSense AI — Autonomous Street Incident Detector
        ### Multi-Task Urban Hazard Screening: Floodwater, Municipal Waste, and Road Damage
        *Upload a single street-level or drone photo to classify incident category, identify fine-grained defect types, and inspect calibrated decision confidences.*
        """
    )
    
    with gr.Row():
        with gr.Column(scale=1):
            input_image = gr.Image(
                type="pil",
                label="Upload Street Scene Photo",
                sources=["upload", "clipboard"]
            )
            with gr.Row():
                detect_btn = gr.Button("🔍 Detect & Classify Incident", variant="primary", size="lg")
                clear_btn = gr.Button("Clear", variant="secondary")
                
            gr.Markdown("### 📂 Curated Benchmark Examples (Click to Load):")
            gr.Examples(
                examples=valid_examples,
                inputs=input_image,
                label=None,
                cache_examples=False
            )
            
        with gr.Column(scale=1):
            annotated_output = gr.Image(
                label="Visual Detection Overlay (Water Mask / Bounding Boxes)",
                type="pil"
            )
            category_card = gr.HTML()
            type_card = gr.HTML()
            
            with gr.Row():
                water_coverage_field = gr.Textbox(label="Water Coverage Ratio", scale=1)
                
            warnings_box = gr.Markdown()
            
            with gr.Accordion("📋 Structured CivicSense JSON Payload", open=False):
                json_output = gr.JSON(label="API Output")
                
    detect_btn.click(
        fn=predict_single_image,
        inputs=input_image,
        outputs=[annotated_output, category_card, type_card, water_coverage_field, warnings_box, json_output]
    )
    
    clear_btn.click(
        fn=lambda: (None, "", "", "0.0%", "", {}),
        inputs=[],
        outputs=[annotated_output, category_card, type_card, water_coverage_field, warnings_box, json_output]
    )

if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=7860, theme=custom_theme, share=False)
