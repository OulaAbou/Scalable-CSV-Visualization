document.getElementById('fullGridButton').addEventListener('click', function() {
  // Create a popup input box
  let filePath = prompt("Please enter the file path:");

  // Check if the user entered a file path
  if (filePath) {
    console.log("File path entered:", filePath);

    // Send the file path to the Flask server
    fetch('/process_file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file_path: filePath })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error('Error:', data.error);
      } else {
        console.log('Clusters:', data.clusters);
        // You can add further processing of the clusters here

        // Define the size of the rectangles and the gap
        const rectSize = 8; // Smaller size for the rectangles
        const gap = 3;

        // Select the container and clear any existing SVG content
        const container = d3.select('.container');
        container.selectAll('svg').remove();

        // Create an SVG element within the container
        const svg = container.append('svg')
          .attr('width', '100%');

        // Initialize the starting y position beneath the button
        let yPos = 60;

        // Loop through each cluster
        data.clusters.forEach((cluster, clusterIndex) => {
          // Loop through each item in the cluster
          cluster.forEach((item, itemIndex) => {
            // Initialize the starting x position for the items
            let xPos = 10;

            // Loop through each element within the item
            item.forEach((element, elementIndex) => {
              // Add a rectangle for each element
              svg.append('rect')
                .attr('x', xPos)
                .attr('y', yPos)
                .attr('width', rectSize)
                .attr('height', rectSize)
                .attr('fill', 'blue');

              // Update the x position for the next element
              xPos += rectSize + gap;
            });

            // Update the y position for the next item
            yPos += rectSize + gap;
          });

          // Add extra space between clusters
          yPos += rectSize + gap;
        });

        // Set the height of the SVG dynamically based on the content
        svg.attr('height', yPos);
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    });
  } else {
    console.log("No file path entered.");
  }
});

