#!/bin/bash

# Define the URL for the Discord API status
url="https://status.discord.com/api/v2/status.json"

echo "Fetching Discord API status from $url..."

# Make a GET request to the Discord API status endpoint and parse the JSON response
response=$(curl -s $url)

if [ $? -ne 0 ]; then
    echo "Failed to fetch the Discord API status."
    exit 1
fi

echo "Successfully fetched the Discord API status."

# Extract relevant status information using jq
status_description=$(echo $response | jq -r '.status.description')
status_indicator=$(echo $response | jq -r '.status.indicator')

echo "Status Description: $status_description"
echo "Status Indicator: $status_indicator"

# Define the components we are interested in
components_of_interest=(
    "API"
    "Media Proxy"
    "Gateway"
    "Push Notifications"
    "Search"
    "Client"
    "Third-party"
    "Server Web Pages"
    "Payments"
    "Marketing Site"
)

echo "Extracting component statuses..."

# Extract the status of the components of interest
components_status=""
for component in "${components_of_interest[@]}"; do
    status=$(echo $response | jq -r --arg component "$component" '.components[]? | select(.name == $component) | "\(.name): \(.status)"')
    if [ -n "$status" ]; then
        components_status+="$status"$'\n'
        echo "Found status for component: $component"
    else
        echo "No status found for component: $component"
    fi
done

# Write the status information to a status.md file
echo "Writing status information to status.md..."

echo "# Discord API Status" > status.md
echo "**Status Description:** $status_description" >> status.md
echo "**Status Indicator:** $status_indicator" >> status.md
echo "" >> status.md
echo "## Component Statuses" >> status.md

# Check if components_status is not empty before writing to the file
if [ -n "$components_status" ]; then
    echo "$components_status" >> status.md
else
    echo "No component statuses available." >> status.md
fi

echo "Script execution completed."