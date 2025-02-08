import pandas as pd

# columns_names = ['ID', 'Diagnosis', 'radius1', 'texture1', 'perimeter1', 'area1', 'smoothness1',
#                      'compactness1', 'concavity1', 'concave_points1', 'symmetry1', 'fractal_dimension1',
#                      'radius2', 'texture2', 'perimeter2', 'area2', 'smoothness2', 'compactness2',
#                      'concavity2', 'concave_points2', 'symmetry2', 'fractal_dimension2',
#                      'radius3', 'texture3', 'perimeter3', 'area3', 'smoothness3', 'compactness3',
#                      'concavity3', 'concave_points3', 'symmetry3', 'fractal_dimension3'
#                     ]

# # Load data
# data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv', names=columns_names)
# # data = data.drop(columns=['ID'])
# data.to_csv('breast+cancer+wisconsin+diagnostic/wdbc_withHeaders.csv', index=False)

data = pd.read_csv('bank+marketing/bank/bank.csv', delimiter=';')
data.sample(n=500).to_csv('bank+marketing/bank/bankCorrect.csv', index=False)
# data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv')
# print(data.head())