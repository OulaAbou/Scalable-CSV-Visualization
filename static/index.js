// let filePath = null;
// let gradients = null;

// // document.getElementById('fullGridButton').addEventListener('click', function() {
// //   // Create a popup input box
// //   filePath = prompt("Please enter the file path:");

// //   // Check if the user entered a file path
// //   if (filePath) {
// //     console.log("File path entered:", filePath);

// //     // Send the file path to the Flask server
// //     fetch('/process_file', {
// //       method: 'POST',
// //       headers: {
// //         'Content-Type': 'application/json'
// //       },
// //       body: JSON.stringify({ file_path: filePath })
// //     })
// //     .then(response => response.json())
// //     .then(data => {
// //       if (data.error) {
// //         console.error('Error:', data.error);
// //       } else {
// //         console.log('Clusters:', data.clusters);
// //         // You can add further processing of the clusters here

// //         // Define the size of the rectangles and the gap
// //         const rectSize = 8; // Smaller size for the rectangles
// //         const gap = 3;

// //         // Select the container and clear any existing SVG content
// //         const container = d3.select('#fullGridButton').node().parentNode;
// //         d3.select(container).selectAll('svg').remove();

// //         // Create an SVG element within the container
// //         const svg = d3.select(container).append('svg')
// //           .attr('width', '100%')
// //           .attr('height', '100%');

// //         // Initialize the starting y position beneath the button
// //         let yPos = 60;

// //         // Custom color palette for string values
// //         const stringColorPalette = ['#ff9999', '#ff6666', '#ff4d4d', '#ff3333', '#ff1a1a', '#ff0000', '#e60000', '#cc0000', '#b30000', '#990000'];

// //         // Calculate color gradients for each index
// //         gradients = data.clusters[0][0].map((_, index) => {
// //           const values = data.clusters.flatMap(cluster => cluster.map(item => item[index]));
// //           if (values.every(value => typeof value === 'number')) {
// //             const min = Math.min(...values);
// //             const max = Math.max(...values);
// //             return d3.scaleLinear()
// //               .domain([min, max])
// //               .range(['#cce5ff', '#004085']); // Lightest to darkest blue
// //           } else if (values.every(value => typeof value === 'string')) {
// //             const uniqueValues = Array.from(new Set(values));
// //             return d3.scaleOrdinal()
// //               .domain(uniqueValues)
// //               .range(stringColorPalette); // Custom color palette for strings
// //           }
// //         });

// //         // Loop through each cluster
// //         data.clusters.forEach((cluster, clusterIndex) => {
// //           // Loop through each item in the cluster
// //           cluster.forEach((item, itemIndex) => {
// //             // Initialize the starting x position for the items
// //             let xPos = 10;

// //             // Loop through each element within the item
// //             item.forEach((element, elementIndex) => {
// //               // Add a rectangle for each element
// //               svg.append('rect')
// //                 .attr('x', xPos)
// //                 .attr('y', yPos)
// //                 .attr('width', rectSize)
// //                 .attr('height', rectSize)
// //                 .attr('fill', gradients[elementIndex](element));

// //               // Update the x position for the next element
// //               xPos += rectSize + gap;
// //             });

// //             // Update the y position for the next item
// //             yPos += rectSize + gap;
// //           });

// //           // Add extra space between clusters
// //           yPos += rectSize + gap;
// //         });

// //         // Set the height of the SVG dynamically based on the content
// //         svg.attr('height', yPos);
// //       }
// //     })
// //     .catch((error) => {
// //       console.error('Error:', error);
// //     });
// //   } else {
// //     console.log("No file path entered.");
// //   }
// // });

// document.getElementById('fullGridButton').addEventListener('click', function() {
//   // Create a file input element
//   const fileInput = document.createElement('input');
//   fileInput.type = 'file';
//   fileInput.accept = '.csv';

//   // Listen for file selection
//   fileInput.addEventListener('change', function(event) {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = function(e) {
//         const csvData = e.target.result;
//         visualizeCSVData(csvData);
//       };
//       reader.readAsText(file);
//     }
//   });

//   // Trigger the file input dialog
//   fileInput.click();
// });

// function visualizeCSVData(csvData) {
//   // Parse the CSV data
//   const data = d3.csvParse(csvData);

//   // Define the size of the rectangles and the gap
//   const rectSize = 10; // Size for the rectangles
//   const gap = 3;

//   // Get the column names
//   const columns = data.columns;

//   // Define the color palette for the top 4 most frequent values
//   const topColors = ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c'];
//   const defaultColor = 'gray';

//   // Calculate the min and max values for each numerical column
//   const numericalScales = columns.map(col => {
//     const values = data.map(row => +row[col]).filter(value => !isNaN(value));
//     if (values.length > 0) {
//       const min = d3.min(values);
//       const max = d3.max(values);
//       return d3.scaleLinear()
//         .domain([min, max])
//         .range(['#fee0d2', '#67000d']); // Lightest to darkest red
//     }
//     return null;
//   });

//   // Calculate the frequency of each value for each categorical column
//   const categoricalColorScales = columns.map(col => {
//     const values = data.map(row => row[col]);
//     const valueCounts = values.reduce((acc, value) => {
//       if (isNaN(value)) {
//         acc[value] = (acc[value] || 0) + 1;
//       }
//       return acc;
//     }, {});

//     // Sort values by frequency and get the top 4 most frequent values
//     const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
//     const topValues = sortedValues.slice(0, 4).map(d => d[0]);

//     // Create a color scale for the top 4 most frequent values
//     const colorScale = d3.scaleOrdinal()
//       .domain(topValues)
//       .range(topColors);

//     return { colorScale, topValues };
//   });

//   // Select the container and clear any existing SVG content
//   const container = d3.select('#fullGridButton').node().parentNode;
//   d3.select(container).selectAll('svg').remove();

//   // Create an SVG element within the container
//   const svg = d3.select(container).append('svg')
//     .attr('width', '100%')
//     .attr('height', '100%')
//     .style('overflow', 'auto');

//   // Initialize the starting y position beneath the button
//   let yPos = 60;

//   // Initialize the maximum x position to determine the width of the SVG
//   let maxXPos = 0;

//   // Loop through each row in the data
//   data.forEach((row, rowIndex) => {
//     // Initialize the starting x position for the items
//     let xPos = 10;

//     // Loop through each value in the row
//     columns.forEach((col, colIndex) => {
//       const value = row[col];
//       let color;

//       if (!isNaN(value)) {
//         // Numerical value
//         color = numericalScales[colIndex] ? numericalScales[colIndex](+value) : defaultColor;
//       } else {
//         // Categorical value
//         const { colorScale, topValues } = categoricalColorScales[colIndex];
//         color = topValues.includes(value) ? colorScale(value) : defaultColor;
//       }

//       // Add a rectangle for each value
//       svg.append('rect')
//         .attr('x', xPos)
//         .attr('y', yPos)
//         .attr('width', rectSize)
//         .attr('height', rectSize)
//         .attr('fill', color);

//       // Update the x position for the next value
//       xPos += rectSize + gap;

//       // Update the maximum x position
//       if (xPos > maxXPos) {
//         maxXPos = xPos;
//       }
//     });

//     // Update the y position for the next row
//     yPos += rectSize + gap;
//   });

//   // Set the width and height of the SVG dynamically based on the content
//   svg.attr('width', maxXPos + 10);
//   svg.attr('height', yPos);
// }

// document.getElementById('gridSummaryButton').addEventListener('click', function() {
//   // Check if the file path has already been entered
//   if (filePath) {
//     console.log("Using previously entered file path:", filePath);

//     // Send the file path to the Flask server
//     fetch('/process_file', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ file_path: filePath })
//     })
//     .then(response => response.json())
//     .then(data => {
//       if (data.error) {
//         console.error('Error:', data.error);
//       } else {
//         console.log('Clusters:', data.clusters);

//         // Define the size of the rectangles and the gap
//         const rectSize = 10; // Larger size for the summary rectangles
//         const gap = 4;

//         // Select the container and clear any existing SVG content
//         const container = d3.select('#gridSummaryButton').node().parentNode;
//         d3.select(container).selectAll('svg').remove();

//         // Create an SVG element within the container
//         const svg = d3.select(container).append('svg')
//           .attr('width', '100%')
//           .attr('height', '100%')
//           .call(d3.zoom().on("zoom", function (event) {
//             svg.attr("transform", event.transform);
//           }))
//           .append("g");

//         // Initialize the starting y position beneath the button
//         let yPos = 60;

//         // Loop through each cluster
//         data.clusters.forEach((cluster, clusterIndex) => {
//           // Initialize the starting x position for the summary rectangles
//           let xPos = 10;

//           // Calculate the summary values for each column
//           const summaryValues = cluster[0].map((_, index) => {
//             const values = cluster.map(item => item[index]);
//             if (values.every(value => typeof value === 'number')) {
//               const mean = d3.mean(values);
//               return mean;
//             } else if (values.every(value => typeof value === 'string')) {
//               const mode = d3.mode(values);
//               return mode;
//             }
//           });

//           // Loop through each summary value
//           summaryValues.forEach((value, index) => {
//             // Add a rectangle for each summary value
//             svg.append('rect')
//               .attr('x', xPos)
//               .attr('y', yPos)
//               .attr('width', rectSize)
//               .attr('height', rectSize)
//               .attr('fill', gradients[index](value));

//             // Update the x position for the next summary value
//             xPos += rectSize + gap;
//           });

//           // Update the y position for the next cluster
//           yPos += rectSize + gap;
//         });

//         // Set the height of the SVG dynamically based on the content
//         svg.attr('height', yPos);
//       }
//     })
//     .catch((error) => {
//       console.error('Error:', error);
//     });
//   } else {
//     console.log("No file path entered. Please enter the file path using the 'Full Grid' button first.");
//   }
// });

// document.getElementById('visualSimilarityMatrixButton').addEventListener('click', function() {
//   // Check if the file path has already been entered
//   if (filePath) {
//     console.log("Using previously entered file path:", filePath);

//     // Send the file path to the Flask server
//     fetch('/visual_similarity_matrix', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ file_path: filePath })
//     })
//     .then(response => response.blob())
//     .then(blob => {
//       const url = URL.createObjectURL(blob);
//       const img = document.createElement('img');
//       img.src = url;
//       img.style.width = '100%';

//       // Select the image-wrapper and clear any existing content
//       const wrapper = d3.select('#visualSimilarityMatrixButton').node().parentNode.querySelector('.image-wrapper');
//       d3.select(wrapper).selectAll('*').remove();
//       wrapper.appendChild(img);
//     })
//     .catch((error) => {
//       console.error('Error:', error);
//     });
//   } else {
//     console.log("No file path entered. Please enter the file path using the 'Full Grid' button first.");
//   }
// });

// document.getElementById('scalableGridButton').addEventListener('click', function() {
//   // Check if the file path has already been entered
//   if (filePath) {
//     console.log("Using previously entered file path:", filePath);

//     // Get the container dimensions
//     const container = d3.select('#scalableGridButton').node().parentNode;
//     const containerHeight = container.clientHeight;
//     const rectSize = 10; // Size for the scalable grid rectangles
//     const gap = 4;

//     // Calculate the number of clusters based on the container height
//     const numClusters = Math.floor(containerHeight / (rectSize + gap));

//     // Send the file path and number of clusters to the Flask server
//     fetch('/cluster_by_number', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ file_path: filePath, num_clusters: numClusters })
//     })
//     .then(response => response.json())
//     .then(data => {
//       if (data.error) {
//         console.error('Error:', data.error);
//       } else {
//         console.log('Clusters:', data.clusters);

//         // Select the container and clear any existing SVG content
//         d3.select(container).selectAll('svg').remove();

//         // Create an SVG element within the container
//         const svg = d3.select(container).append('svg')
//           .attr('width', '100%')
//           .attr('height', '100%')
//           .call(d3.zoom().on("zoom", debounce(function (event) {
//             svg.attr("transform", event.transform);
//             updateClusters();
//           }, 200)))
//           .append("g");

//         // Function to update clusters based on zoom level
//         function updateClusters() {
//           const transform = d3.zoomTransform(svg.node());
//           const newRectSize = rectSize / transform.k;
//           const newGap = gap / transform.k;
//           const newNumClusters = Math.floor(containerHeight / (newRectSize + newGap));

//           // Send the updated number of clusters to the Flask server
//           fetch('/cluster_by_number', {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ file_path: filePath, num_clusters: newNumClusters })
//           })
//           .then(response => response.json())
//           .then(data => {
//             if (data.error) {
//               console.error('Error:', data.error);
//             } else {
//               console.log('Updated Clusters:', data.clusters);

//               // Clear existing content
//               svg.selectAll('*').remove();

//               // Initialize the starting y position beneath the button
//               let yPos = 60;

//               // Loop through each cluster
//               data.clusters.forEach((cluster, clusterIndex) => {
//                 // Initialize the starting x position for the scalable grid rectangles
//                 let xPos = 10;

//                 // Loop through each item in the cluster
//                 cluster.forEach((item, itemIndex) => {
//                   // Initialize the starting x position for the items
//                   xPos = 10;

//                   // Loop through each element within the item
//                   item.forEach((element, elementIndex) => {
//                     // Add a rectangle for each element
//                     svg.append('rect')
//                       .attr('x', xPos)
//                       .attr('y', yPos)
//                       .attr('width', newRectSize)
//                       .attr('height', newRectSize)
//                       .attr('fill', gradients[elementIndex](element));

//                     // Update the x position for the next element
//                     xPos += newRectSize + newGap;
//                   });

//                   // Update the y position for the next item
//                   yPos += newRectSize + newGap;
//                 });

//                 // Add extra space between clusters
//                 yPos += newRectSize + newGap;
//               });

//               // Set the height of the SVG dynamically based on the content
//               svg.attr('height', yPos);
//             }
//           })
//           .catch((error) => {
//             console.error('Error:', error);
//           });
//         }

//         // Initial call to update clusters
//         updateClusters();
//       }
//     })
//     .catch((error) => {
//       console.error('Error:', error);
//     });
//   } else {
//     console.log("No file path entered. Please enter the file path using the 'Full Grid' button first.");
//   }
// });

// // Debounce function to limit the rate at which a function can fire
// function debounce(func, wait) {
//   let timeout;
//   return function(...args) {
//     const context = this;
//     clearTimeout(timeout);
//     timeout = setTimeout(() => func.apply(context, args), wait);
//   };
// }

let file = null;

document.getElementById('fullGridButton').addEventListener('click', function() {
  // Create a file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';

  // Listen for file selection
  fileInput.addEventListener('change', function(event) {
    file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const csvData = e.target.result;
        visualizeCSVData(csvData);
      };
      reader.readAsText(file);
    }
  });

  // Trigger the file input dialog
  fileInput.click();
});

function visualizeCSVData(csvData) {
  // Parse the CSV data
  const data = d3.csvParse(csvData);

  // Define the size of the rectangles and the gap
  const rectSize = 8; // Size for the rectangles
  const gap = 3;

  // Get the column names
  const columns = data.columns;

  // Define the color palette for the top 4 most frequent values
  const topColors = ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c'];
  const defaultColor = 'gray';

  // Calculate the min and max values for each numerical column
  const numericalScales = columns.map(col => {
    const values = data.map(row => +row[col]).filter(value => !isNaN(value));
    if (values.length > 0) {
      const min = d3.min(values);
      const max = d3.max(values);
      return d3.scaleLinear()
        .domain([min, max])
        .range(['#ffcccc', '#ff0000']); // Lightest to darkest red
    }
    return null;
  });

  // Calculate the frequency of each value for each categorical column
  const categoricalColorScales = columns.map(col => {
    const values = data.map(row => row[col]);
    const valueCounts = values.reduce((acc, value) => {
      if (isNaN(value)) {
        acc[value] = (acc[value] || 0) + 1;
      }
      return acc;
    }, {});

    // Sort values by frequency and get the top 4 most frequent values
    const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
    const topValues = sortedValues.slice(0, 4).map(d => d[0]);

    // Create a color scale for the top 4 most frequent values
    const colorScale = d3.scaleOrdinal()
      .domain(topValues)
      .range(topColors);

    return { colorScale, topValues };
  });

  // Select the container and clear any existing SVG content
  const container = d3.select('#fullGridButton').node().parentNode;
  d3.select(container).selectAll('svg').remove();

  // Create an SVG element within the container
  const svg = d3.select(container).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('overflow', 'auto');

  // Initialize the starting y position beneath the button
  let yPos = 60;

  // Initialize the maximum x position to determine the width of the SVG
  let maxXPos = 0;

  // Loop through each row in the data
  data.forEach((row, rowIndex) => {
    // Initialize the starting x position for the items
    let xPos = 10;

    // Loop through each value in the row
    columns.forEach((col, colIndex) => {
      const value = row[col];
      let color;

      if (!isNaN(value)) {
        // Numerical value
        color = numericalScales[colIndex] ? numericalScales[colIndex](+value) : defaultColor;
      } else {
        // Categorical value
        const { colorScale, topValues } = categoricalColorScales[colIndex];
        color = topValues.includes(value) ? colorScale(value) : defaultColor;
      }

      // Add a rectangle for each value
      svg.append('rect')
        .attr('x', xPos)
        .attr('y', yPos)
        .attr('width', rectSize)
        .attr('height', rectSize)
        .attr('fill', color);

      // Update the x position for the next value
      xPos += rectSize + gap;

      // Update the maximum x position
      if (xPos > maxXPos) {
        maxXPos = xPos;
      }
    });

    // Update the y position for the next row
    yPos += rectSize + gap;
  });

  // Set the width and height of the SVG dynamically based on the content
  svg.attr('width', maxXPos + 10);
  svg.attr('height', yPos);
}

document.getElementById('gridSummaryButton').addEventListener('click', function() {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/upload_file', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error('Error:', data.error);
      } else {
        console.log('Blocks:', data.blocks);

        // Select the container and clear any existing SVG content
        const container = d3.select('#gridSummaryButton').node().parentNode;
        d3.select(container).selectAll('svg').remove();

        // Create an SVG element within the container
        const svg = d3.select(container).append('svg')
          .attr('width', '100%')
          .attr('height', '100%');

        // Initialize the starting y position beneath the button
        let yPos = 60;

        // Define the gap between blocks
        const gap = 3;

        // Initialize an object to keep track of the current x and y positions for each row cluster
        const clusterPositions = {};

        // Loop through each block
        Object.entries(data.blocks).forEach(([key, block]) => {
          const [rowCluster, colCluster, blockId, blockType] = key.split(',');
          const blockHeight = block.length * 10; // Height proportional to cluster size
          const blockWidth = block[0].length * 10; // Width proportional to number of columns
          const color = blockType === 'numerical' ? 'red' : 'blue';

          // Initialize the positions for the current row cluster if not already done
          if (!clusterPositions[rowCluster]) {
            clusterPositions[rowCluster] = { x: 10, y: yPos };
            yPos += blockHeight + gap; // Update yPos for the next cluster
          }

          // Add a rectangle for each block
          svg.append('rect')
            .attr('x', clusterPositions[rowCluster].x)
            .attr('y', clusterPositions[rowCluster].y)
            .attr('width', blockWidth)
            .attr('height', blockHeight)
            .attr('fill', color);

          // Update the x position for the next block in the same row cluster
          clusterPositions[rowCluster].x += blockWidth + gap;
        });

        // Set the height of the SVG dynamically based on the content
        svg.attr('height', yPos);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
  } else {
    console.log("No file selected. Please select a file using the 'Full Grid' button first.");
  }
});