# EKIP API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "role": "ADMIN",
      "avatar": "https://example.com/avatar.jpg"
    },
    "token": "jwt_token_here"
  }
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

## Users

### Get All Users
```http
GET /users
Authorization: Bearer <token>
```

### Get User by ID
```http
GET /users/:id
Authorization: Bearer <token>
```

### Create User
```http
POST /users
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New User",
  "email": "newuser@example.com",
  "role": "EMPLOYEE"
}
```

## Projects

### Get All Projects
```http
GET /projects
Authorization: Bearer <token>
```

### Get Project by ID
```http
GET /projects/:id
Authorization: Bearer <token>
```

### Create Project
```http
POST /projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Project Name",
  "description": "Project description",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "budget": 50000,
  "priority": "HIGH"
}
```

## Allocations

### Get All Allocations
```http
GET /allocations
Authorization: Bearer <token>
```

### Get Allocation by ID
```http
GET /allocations/:id
Authorization: Bearer <token>
```

### Create Allocation
```http
POST /allocations
Authorization: Bearer <token>
Content-Type: application/json

{
  "employeeId": "employee_id",
  "projectId": "project_id",
  "taskId": "task_id",
  "weekStart": "2024-01-01",
  "weekEnd": "2024-01-07",
  "hours": 40,
  "notes": "Allocation notes"
}
```

## Employees

### Get All Employees
```http
GET /employees
Authorization: Bearer <token>
```

### Get Employee by ID
```http
GET /employees/:id
Authorization: Bearer <token>
```

### Create Employee
```http
POST /employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Employee Name",
  "email": "employee@example.com",
  "employeeCode": "EMP001",
  "department": "IT",
  "position": "Developer",
  "hourlyRate": 50
}
```

## Dashboard

### Get Dashboard Stats
```http
GET /dashboard/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalHours": 1248,
    "utilizationRate": 78,
    "deviations": 42,
    "activeProjects": 5,
    "activeEmployees": 12,
    "weeklyTrend": {
      "planned": 400,
      "actual": 380
    }
  }
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Pagination

For endpoints that return lists, pagination is supported:

```http
GET /projects?page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
``` 