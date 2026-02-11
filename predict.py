import sys
import json
import pickle
import Orange
import numpy as np

# Suppress warnings
import warnings
warnings.filterwarnings("ignore")

def main():
    try:
        # Load the model
        with open('HeartModel.pkcls', 'rb') as f:
            model = pickle.load(f)
        
        domain = model.domain
        attributes = domain.attributes
        class_var = domain.class_var

        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input data provided"}))
            return

        data_list = json.loads(input_data)
        if isinstance(data_list, dict):
            data_list = [data_list]

        # Field mapping from website manual entry names to logical index (1-13)
        manual_mapping = {
            "age": 1,
            "sex": 2,
            "chest_pain": 3,
            "rbp": 4,
            "cholesterol": 5,
            "fbs": 6,
            "ecg": 7,
            "max_hr": 8,
            "angina": 9,
            "oldpeak": 10,
            "slope": 11,
            "vessels": 12,
            "thal": 13
        }

        results = []
        for item in data_list:
            # Extract 13 features from input
            # CSV keys are "0", "1", ... "12"
            # Manual keys are from manual_mapping
            extracted_13 = {}
            for i in range(1, 14):
                # Try CSV index first (0-based)
                val = item.get(str(i-1))
                if val is None:
                    # Try manual names
                    name = next((k for k, v in manual_mapping.items() if v == i), None)
                    if name:
                        val = item.get(name)
                
                # Convert to float or default to 0.0
                try:
                    extracted_13[i] = float(val) if val is not None else 0.0
                except:
                    extracted_13[i] = 0.0

            # Map 13 extracted features to the model's attributes (which might be more than 13 due to encoding)
            # Based on inspection:
            # Feature 1 -> ext[1]
            # Feature 2=0.0 -> 1 if ext[2]==0 else 0
            # Feature 2=1.0 -> 1 if ext[2]==1 else 0
            # Feature 3 -> ext[3]
            # Feature 4 -> ext[4]
            # Feature 5 -> ext[5]
            # Feature 6=0.0 -> 1 if ext[6]==0 else 0
            # Feature 6=1.0 -> 1 if ext[6]==1 else 0
            # Feature 7 -> ext[7]
            # Feature 8 -> ext[8]
            # Feature 9=0.0 -> 1 if ext[9]==0 else 0
            # Feature 9=1.0 -> 1 if ext[9]==1 else 0
            # Feature 10 -> ext[10]
            # Feature 11 -> ext[11]
            # Feature 12 -> ext[12]
            # Feature 13 -> ext[13]

            row_values = []
            for attr in attributes:
                name = attr.name
                # Check for categorical expansion pattern "Feature X=Y"
                if "Feature " in name and "=" in name:
                    base_part = name.split("=")[0] # e.g. "Feature 2"
                    val_part = name.split("=")[1]  # e.g. "0.0"
                    
                    feat_idx = int(base_part.replace("Feature ", ""))
                    target_val = float(val_part)
                    
                    if abs(extracted_13.get(feat_idx, 0.0) - target_val) < 0.0001:
                        row_values.append(1.0)
                    else:
                        row_values.append(0.0)
                elif "Feature " in name:
                    feat_idx = int(name.replace("Feature ", ""))
                    row_values.append(extracted_13.get(feat_idx, 0.0))
                else:
                    # Fallback to index if name is something else
                    row_values.append(0.0)

            # Create Orange Table for this row
            data_table = Orange.data.Table(domain, [row_values])
            
            # Predict
            pred_res = model(data_table)
            pred_idx = pred_res[0]
            
            # Probabilities
            probs_res = model(data_table, model.Probs)
            probs = probs_res[0]
            
            prediction_text = class_var.values[int(pred_idx)]
            is_risk = str(prediction_text) != "0"
            
            # Heuristic-based explanation logic
            # Features: 1:age, 2:sex, 3:cp, 4:rbp, 5:chol, 6:fbs, 7:ecg, 8:max_hr, 9:angina, 10:oldpeak, 11:slope, 12:vessels, 13:thal
            impacts = []
            
            # 12. Vessels (ca) - High impact
            vessels = extracted_13.get(12, 0)
            impacts.append({"name": "Major Coronary Vessels", "val": vessels, "risky": vessels > 0, "magnitude": vessels * 0.4})
            
            # 10. Oldpeak (ST depression) - High impact
            oldpeak = extracted_13.get(10, 0)
            impacts.append({"name": "ST depression", "val": oldpeak, "risky": oldpeak > 1.0, "magnitude": oldpeak * 0.3})
            
            # 13. Thal - High impact
            thal = extracted_13.get(13, 0)
            impacts.append({"name": "Thalassemia result", "val": thal, "risky": thal > 2, "magnitude": (thal - 2) * 0.4})
            
            # 8. Max HR - High impact (Inverse)
            max_hr = extracted_13.get(8, 0)
            impacts.append({"name": "Maximum heart rate", "val": max_hr, "risky": max_hr < 140, "magnitude": (180 - max_hr) * 0.01})
            
            # 3. Chest Pain - Moderate impact
            cp = extracted_13.get(3, 0)
            impacts.append({"name": "Chest pain type", "val": cp, "risky": cp > 0, "magnitude": cp * 0.2})

            # 9. Angina
            angina = extracted_13.get(9, 0)
            impacts.append({"name": "Exercise-Induced Angina", "val": angina, "risky": angina == 1, "magnitude": angina * 0.3})

            # Sort by magnitude of divergence from "healthy"
            sorted_impacts = sorted(impacts, key=lambda x: x['magnitude'], reverse=True)
            
            top_factor_names = []
            if is_risk:
                top_factor_names = [x['name'] for x in sorted_impacts if x['risky']][:3]
                if not top_factor_names: top_factor_names = [sorted_impacts[0]['name']]
            else:
                top_factor_names = [x['name'] for x in sorted_impacts if not x['risky']][:3]
                if not top_factor_names: top_factor_names = [sorted_impacts[0]['name']]

            results.append({
                "prediction": str(prediction_text),
                "probability": float(probs[int(pred_idx)]),
                "is_risk": is_risk,
                "factors": top_factor_names
            })

        if len(results) == 1:
            print(json.dumps(results[0]))
        else:
            print(json.dumps(results))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
