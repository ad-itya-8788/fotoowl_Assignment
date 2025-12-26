🐰 RabbitMQ START karne ka SEEDHA tareeqa (Windows + Docker)
✅ STEP 1: Docker Desktop RUNNING hona chahiye

pehle confirm:

docker info


agar output aa gaya → Docker ready ✅

✅ STEP 2: RabbitMQ START karne ka command

👉 CMD / PowerShell me ye ONE LINE paste karo:

docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

iska matlab:

-d → background me chale

--name rabbitmq → container ka naam

5672 → app/worker ke liye

15672 → dashboard (UI) ke liye

✅ STEP 3: confirm RabbitMQ chal raha hai ya nahi
terminal me:
docker ps


output me dikhe:

rabbitmq   rabbitmq:3-management

✅ STEP 4: RabbitMQ dashboard open karo

browser me:

http://localhost:15672


login:

username: guest
password: guest


agar dashboard aa gaya → RabbitMQ STARTED 🎉

🔁 agar RabbitMQ pehle se bana ho
stop karne ke liye:
docker stop rabbitmq

dobara start karne ke liye:
docker start rabbitmq


⚠️ dobara docker run tabhi use karo jab container delete ho

🧠 SHORT yaad rakhne wali baat
kaam	command
start	docker start rabbitmq
stop	docker stop rabbitmq
delete	docker rm rabbitmq
status	docker ps