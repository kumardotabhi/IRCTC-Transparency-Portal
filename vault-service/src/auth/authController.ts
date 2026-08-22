import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'tatkal-vault-default-secret';

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required.'
        });
      }

      if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address.'
        });
      }

      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long.'
        });
      }

      const existingUser = db.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.'
        });
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const newUser = db.createUser({
        id: uuidv4(),
        email: email.trim().toLowerCase(),
        passwordHash,
        createdAt: new Date().toISOString()
      });

      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        data: {
          token,
          user: {
            id: newUser.id,
            email: newUser.email,
            createdAt: newUser.createdAt
          }
        }
      });
    } catch (err: any) {
      console.error('[Auth.signup] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during account creation.'
      });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required.'
        });
      }

      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }

      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt
          }
        }
      });
    } catch (err: any) {
      console.error('[Auth.login] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during login.'
      });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const user = db.findUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  }
}

