import numpy as np
import pandas as pd
np.random.seed(42)

# Number of samples
n_samples = 500

def create_lifestyle_cluster(n, profile):
    """Creates a cluster of individuals with similar health characteristics"""
    data = {}
    
    # Base characteristics with more variation
    data['gender'] = [profile['gender']] * n
    data['age'] = np.random.normal(profile['age'], profile['age_std'] * 1.5, n)
    
    # Health metrics based on profile with increased standard deviations
    data['bmi'] = np.random.normal(profile['bmi'], 4, n)
    data['systolic_bp'] = np.random.normal(profile['systolic_bp'], 12, n)
    data['heart_rate'] = np.random.normal(profile['heart_rate'], 10, n)
    data['cholesterol'] = np.random.normal(profile['cholesterol'], 30, n)
    data['blood_sugar'] = np.random.normal(profile['blood_sugar'], 20, n)
    data['fitness_level'] = np.random.normal(profile['fitness_level'], 15, n)
    data['exercise_freq'] = np.random.normal(profile['exercise_freq'], 1.5, n).clip(0, 7)
    data['stress_level'] = np.random.normal(profile['stress_level'], 2, n).clip(1, 10)
    
    # Categorical variables
    data['smoking_status'] = [profile['smoking_status']] * n
    data['sleep_quality'] = [profile['sleep_quality']] * n
    data['family_history'] = [profile['family_history']] * n
    
    return pd.DataFrame(data)

# Define distinct clusters
clusters = [
    {   # Cluster 1: Unhealthy male smokers (high risk)
        'size': 100,
        'profile': {
            'gender': 'Male',
            'age': 60, 'age_std': 5,
            'bmi': 32,
            'systolic_bp': 150,
            'heart_rate': 95,
            'cholesterol': 260,
            'blood_sugar': 180,
            'fitness_level': 40,
            'exercise_freq': 1,
            'stress_level': 8,
            'smoking_status': 'Current',
            'sleep_quality': 'Poor',
            'family_history': 'Yes'
        }
    },
    {   # Cluster 2: Healthy young females (low risk)
        'size': 100,
        'profile': {
            'gender': 'Female',
            'age': 30, 'age_std': 5,
            'bmi': 22,
            'systolic_bp': 110,
            'heart_rate': 70,
            'cholesterol': 170,
            'blood_sugar': 90,
            'fitness_level': 85,
            'exercise_freq': 5,
            'stress_level': 3,
            'smoking_status': 'Never',
            'sleep_quality': 'Excellent',
            'family_history': 'No'
        }
    },
    {   # Cluster 3: Older health-conscious males (moderate risk)
        'size': 100,
        'profile': {
            'gender': 'Male',
            'age': 65, 'age_std': 5,
            'bmi': 24,
            'systolic_bp': 135,
            'heart_rate': 75,
            'cholesterol': 200,
            'blood_sugar': 110,
            'fitness_level': 70,
            'exercise_freq': 4,
            'stress_level': 4,
            'smoking_status': 'Former',
            'sleep_quality': 'Good',
            'family_history': 'Yes'
        }
    },
    {   # Cluster 4: Middle-aged sedentary females (moderate-high risk)
        'size': 100,
        'profile': {
            'gender': 'Female',
            'age': 50, 'age_std': 5,
            'bmi': 29,
            'systolic_bp': 140,
            'heart_rate': 85,
            'cholesterol': 230,
            'blood_sugar': 150,
            'fitness_level': 50,
            'exercise_freq': 1,
            'stress_level': 7,
            'smoking_status': 'Former',
            'sleep_quality': 'Fair',
            'family_history': 'No'
        }
    },
    {   # Cluster 5: Young active males (low risk)
        'size': 100,
        'profile': {
            'gender': 'Male',
            'age': 28, 'age_std': 4,
            'bmi': 23,
            'systolic_bp': 115,
            'heart_rate': 65,
            'cholesterol': 160,
            'blood_sugar': 85,
            'fitness_level': 90,
            'exercise_freq': 6,
            'stress_level': 3,
            'smoking_status': 'Never',
            'sleep_quality': 'Excellent',
            'family_history': 'No'
        }
    }
]

# Combine all clusters
data = pd.concat([create_lifestyle_cluster(cluster['size'], cluster['profile']) 
                 for cluster in clusters], ignore_index=True)

# Calculate heart condition risk based on multiple factors
risk_factors = (
    (data['age'] > 60).astype(int) * 2 +
    (data['systolic_bp'] > 140).astype(int) * 2 +
    (data['cholesterol'] > 240).astype(int) * 1.5 +
    (data['heart_rate'] > 90).astype(int) * 1.5 +
    (data['blood_sugar'] > 150).astype(int) * 1 +
    (data['bmi'] > 30).astype(int) * 1 +
    (data['gender'] == 'Male').astype(int) * 0.5 +
    (data['family_history'] == 'Yes').astype(int) * 1 +
    (data['smoking_status'] == 'Current').astype(int) * 1.5 +
    (data['sleep_quality'] == 'Poor').astype(int) * 0.5 +
    (data['stress_level'] > 7).astype(int) * 0.5
)
data['heart_condition_risk'] = (risk_factors > 5).astype(int)

# Add more substantial random variations to numerical columns
numerical_cols = ['age', 'systolic_bp', 'cholesterol', 'fitness_level', 
                 'heart_rate', 'bmi', 'blood_sugar', 'exercise_freq', 'stress_level']
for col in numerical_cols:
    data[col] = data[col] + np.random.normal(0, data[col].std() * 0.25, len(data))
    data[col] = data[col].round(1)

# Randomly shuffle some categorical values to create more noise
shuffle_mask = np.random.random(len(data)) < 0.15  # 15% chance of shuffling
data.loc[shuffle_mask, 'smoking_status'] = np.random.choice(['Never', 'Former', 'Current'], size=sum(shuffle_mask))
data.loc[shuffle_mask, 'sleep_quality'] = np.random.choice(['Poor', 'Fair', 'Good', 'Excellent'], size=sum(shuffle_mask))
data.loc[shuffle_mask, 'family_history'] = np.random.choice(['Yes', 'No'], size=sum(shuffle_mask))

# Generate random IDs
def generate_random_id():
    letters = ''.join(np.random.choice(list('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 2))
    numbers = ''.join(np.random.choice(list('0123456789'), 4))
    return f"{letters}{numbers}"

# Add random IDs to the data
data['ID'] = [generate_random_id() for _ in range(len(data))]

# Ensure IDs are unique
while len(data['ID'].unique()) != len(data):
    duplicate_mask = data['ID'].duplicated()
    data.loc[duplicate_mask, 'ID'] = [generate_random_id() for _ in range(sum(duplicate_mask))]

# Define column order
column_order = [
    'ID', 'gender', 'age', 'bmi', 'systolic_bp', 'heart_rate', 'cholesterol', 
    'blood_sugar', 'fitness_level', 'exercise_freq', 'stress_level',
    'sleep_quality', 'smoking_status', 'family_history', 'heart_condition_risk'
]
data = data[column_order]

print("First few rows of the dataset:")
print(data.head())

print("\nCorrelation matrix for numerical features:")
numerical_data = data.select_dtypes(include=[np.number])
print(numerical_data.corr().round(2))

# Print cluster sizes
print("\nCluster distributions:")
print("\nGender and Smoking Status:")
print(pd.crosstab(data['gender'], data['smoking_status']))

print("\nRisk Distribution by Gender:")
print(pd.crosstab(data['gender'], data['heart_condition_risk']))

# Randomly shuffle the data
data = data.sample(frac=1).reset_index(drop=True)

# Save to CSV
data.to_csv('Data/health_metrics.csv', index=False)
print("\nData saved to 'health_metrics.csv'")