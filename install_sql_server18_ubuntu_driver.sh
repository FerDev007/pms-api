#!/bin/bash

# Check if running on supported Ubuntu version
if ! [[ "18.04 20.04 22.04 24.04 24.10" == *"$(grep VERSION_ID /etc/os-release | cut -d '"' -f 2)"* ]];
then
    echo "Ubuntu $(grep VERSION_ID /etc/os-release | cut -d '"' -f 2) is not currently supported.";
    exit 1;
fi

# Download the package to configure the Microsoft repo
curl -sSL -O https://packages.microsoft.com/config/ubuntu/$(grep VERSION_ID /etc/os-release | cut -d '"' -f 2)/packages-microsoft-prod.deb

# Install the package (no sudo needed in Docker)
dpkg -i packages-microsoft-prod.deb

# Delete the file
rm packages-microsoft-prod.deb

# Update package list and install the driver
apt-get update
ACCEPT_EULA=Y apt-get install -y msodbcsql18

# Optional: for bcp and sqlcmd
ACCEPT_EULA=Y apt-get install -y mssql-tools18

# Optional: for unixODBC development headers
apt-get install -y unixodbc-dev

# Clean up package cache
rm -rf /var/lib/apt/lists/*

echo "ODBC Driver 18 for SQL Server installation completed."