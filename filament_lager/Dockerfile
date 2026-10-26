FROM python:3.12-alpine

WORKDIR /app
# Material Design Icons (wie in Home Assistant) einmal beim Bauen holen.
COPY mdi_build.py /app/mdi_build.py
RUN python3 /app/mdi_build.py /app/mdi.json
COPY server.py /app/server.py
COPY www /app/www

CMD ["python3", "-u", "/app/server.py"]
