export class ApiResponse {
  static success(data: any, message = 'Success', statusCode = 200) {
    return {
      status: 'success',
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
    }
  }

  static error(message: string, statusCode = 500, errors?: any) {
    return {
      status: 'error',
      statusCode,
      message,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
    }
  }

  static paginated(data: any[], page: number, limit: number, total: number) {
    return {
      status: 'success',
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    }
  }
}
