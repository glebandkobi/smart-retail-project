
# Simple Nginx server
FROM nginx:alpine

# Copy your index.html directly to the Nginx html folder
COPY public/index.html /usr/share/nginx/html/index.html

# Expose port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]