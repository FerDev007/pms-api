from fastapi import FastAPI

app = FastAPI(title="PMS API")


@app.get("/")
async def ok():
    return {"detail": "ok"}
