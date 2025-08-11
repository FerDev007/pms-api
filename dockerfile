FROM ubuntu:24.04

# Install Python and pip (uses Python 3.12 in Ubuntu 24.04)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libc6-dev \
    unixodbc-dev \
    libmariadb-dev \
    sudo \
    gpg \
    curl \
    make \
    snmp \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Download SQL Server drivers (using your script)
COPY install_sql_server18_ubuntu_driver.sh .
# Make the script executable and run it
RUN chmod +x install_sql_server18_ubuntu_driver.sh && ./install_sql_server18_ubuntu_driver.sh

# Verify ODBC driver installation
RUN odbcinst -q -d -n "ODBC Driver 18 for SQL Server" || echo "Driver not found in odbcinst"
RUN ls -la /opt/microsoft/msodbcsql18/ || echo "msodbcsql18 directory not found"

# Add mssql-tools to PATH
ENV PATH="$PATH:/opt/mssql-tools18/bin"

# Copy the requirements file
COPY requirements.txt .

# Install Python dependencies using --break-system-packages
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application files
COPY . .

# Create user and group
RUN groupadd app && useradd -r -g app app

# Set ownership to the app user of the working directory
RUN chown -R app:app /app

# Switch to the app user
USER app

# Expose the port
EXPOSE 8002

# Entry point
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]